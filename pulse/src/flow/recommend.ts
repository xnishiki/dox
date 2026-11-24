import { GENRES } from '../lib/categories'
import { jamendo } from '../lib/jamendo'
import type { Track } from '../lib/types'
import type { FlowPrefs, TasteEvent } from '../store/taste'

/**
 * Подбор треков для «Потока».
 * 1. Из истории считаем веса жанров/тегов и исполнителей (недавнее важнее — затухание с полупериодом 2 недели).
 * 2. Выбираем 2–3 жанра случайно, пропорционально весам, плюс один «новый» жанр для разнообразия.
 * 3. Запрашиваем кандидатов у Jamendo с учётом настроения и характера волны.
 * 4. Оцениваем каждого кандидата, убираем недавно игравшие и дизлайкнутые, перемешиваем исполнителей.
 */

const HALF_LIFE = 14 * 24 * 3600 * 1000
const EVENT_WEIGHT: Record<TasteEvent['type'], number> = { complete: 1, like: 3, unlike: -1, skip: -0.6, dislike: -3 }
const EXPLORATION = 0.25

const MOOD_TAGS: Record<FlowPrefs['mood'], string | undefined> = {
  any: undefined,
  upbeat: 'energetic+happy+upbeat+dance',
  calm: 'calm+relaxing+chillout+ambient',
  sad: 'sad+melancholic+emotional',
}

const ORDER: Record<FlowPrefs['character'], string> = {
  favorite: 'popularity_month',
  new: 'releasedate_desc',
  popular: 'popularity_week',
}

const KNOWN_GENRES = new Set(GENRES.flatMap((g) => (g.query.tags ? [g.query.tags] : g.query.fuzzytags!.split('+'))))

export interface Taste {
  genres: Map<string, number>
  artists: Map<string, number>
}

export function computeTaste(events: TasteEvent[], prefs: FlowPrefs, now = Date.now()): Taste {
  const genres = new Map<string, number>()
  const artists = new Map<string, number>()
  for (const e of events) {
    const w = EVENT_WEIGHT[e.type] * Math.pow(0.5, (now - e.at) / HALF_LIFE)
    for (const g of e.g) genres.set(g, (genres.get(g) ?? 0) + w)
    if (e.a) artists.set(e.a, (artists.get(e.a) ?? 0) + w)
  }
  // Жанры, выбранные в настройках, всегда в приоритете
  for (const g of prefs.genres) genres.set(g, (genres.get(g) ?? 0) + 2.5)
  return { genres, artists }
}

function weightedPick<T>(items: Array<[T, number]>, rnd = Math.random): T | undefined {
  const pos = items.filter(([, w]) => w > 0)
  const total = pos.reduce((s, [, w]) => s + w, 0)
  if (!total) return undefined
  let r = rnd() * total
  for (const [v, w] of pos) { r -= w; if (r <= 0) return v }
  return pos[pos.length - 1][0]
}

/** Какие жанры запросить: 2 по вкусу + 1 для разнообразия */
export function chooseGenres(taste: Taste, prefs: FlowPrefs, rnd = Math.random): { liked: string[]; explore: string } {
  // Учитываем только настоящие жанры Jamendo, а не любые теги
  const candidates = [...taste.genres.entries()].filter(([g]) => KNOWN_GENRES.has(g))
  const liked: string[] = []
  for (let i = 0; i < 2; i++) {
    const g = weightedPick(candidates.filter(([x]) => !liked.includes(x)), rnd)
    if (g) liked.push(g)
  }
  if (!liked.length && prefs.genres.length) liked.push(...prefs.genres.slice(0, 2))
  const pool = [...KNOWN_GENRES].filter((g) => !liked.includes(g) && (taste.genres.get(g) ?? 0) >= -1)
  const explore = pool[Math.floor(rnd() * pool.length)] ?? 'pop'
  return { liked, explore }
}

export function scoreTrack(t: Track, taste: Taste, rnd = Math.random): number {
  const tags = [...(t.genres ?? []), ...(t.tags ?? [])]
  const g = tags.reduce((s, x) => s + Math.max(-3, Math.min(6, taste.genres.get(x) ?? 0)), 0) / Math.max(1, Math.sqrt(tags.length))
  const a = t.artistId ? Math.max(-4, Math.min(6, taste.artists.get(t.artistId) ?? 0)) : 0
  return g + a * 0.7 + rnd() * 1.5
}

/** Не ставим одного исполнителя два раза подряд */
export function spreadArtists<T extends Track>(list: T[]): T[] {
  const out: T[] = []
  const rest = [...list]
  while (rest.length) {
    const i = rest.findIndex((t) => t.artistId !== out[out.length - 1]?.artistId)
    out.push(...rest.splice(i < 0 ? 0 : i, 1))
  }
  return out
}

export interface RecommendInput {
  events: TasteEvent[]
  disliked: string[]
  prefs: FlowPrefs
  /** id треков, которые уже звучали или стоят в очереди */
  exclude: Set<string>
  count?: number
}

export async function recommend({ events, disliked, prefs, exclude, count = 10 }: RecommendInput, signal?: AbortSignal): Promise<Track[]> {
  const taste = computeTaste(events, prefs)
  const { liked, explore } = chooseGenres(taste, prefs)
  const mood = MOOD_TAGS[prefs.mood]
  const order = ORDER[prefs.character]
  const offset = () => (prefs.character === 'new' ? 0 : Math.floor(Math.random() * 6) * 20)

  const requests: Array<Promise<Array<Track & { _explore?: boolean }>>> = []
  const ask = (params: Record<string, string | number | undefined>, isExplore = false) =>
    requests.push(
      jamendo.tracks({ order, fuzzytags: mood, limit: 30, ...params }, signal)
        .then((r) => (r.length || !params.offset ? r : jamendo.tracks({ order, fuzzytags: mood, limit: 30, ...params, offset: 0 }, signal)))
        .then((r) => r.map((t) => (isExplore ? { ...t, _explore: true } : t)))
        .catch(() => []),
    )

  if (liked.length) liked.forEach((g) => ask({ tags: g, offset: offset() }))
  else ask({ offset: offset() }) // холодный старт: просто популярное
  ask({ tags: explore, offset: offset() }, true)

  // «Любимое»: добавляем треки исполнителей, которые нравятся
  if (prefs.character === 'favorite') {
    const topArtists = [...taste.artists.entries()].filter(([, w]) => w > 1.5).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const artist = weightedPick(topArtists)
    if (artist) ask({ artist_id: artist, order: 'popularity_total', fuzzytags: undefined, offset: 0 })
  }

  const dislikedSet = new Set(disliked)
  const seen = new Set<string>()
  const pool = (await Promise.all(requests)).flat().filter((t) => {
    if (seen.has(t.id) || exclude.has(t.id) || dislikedSet.has(t.id)) return false
    if (t.artistId && (taste.artists.get(t.artistId) ?? 0) <= -2.5) return false
    seen.add(t.id)
    return true
  })

  const scored = pool.map((t) => ({ t, s: scoreTrack(t, taste) }))
  const main = scored.filter((x) => !x.t._explore).sort((a, b) => b.s - a.s).map((x) => x.t)
  const fresh = scored.filter((x) => x.t._explore).sort((a, b) => b.s - a.s).map((x) => x.t)
  const nExplore = Math.min(fresh.length, Math.max(1, Math.round(count * EXPLORATION)))
  const picked = [...main.slice(0, count - nExplore), ...fresh.slice(0, nExplore)]
  if (picked.length < count) picked.push(...[...main, ...fresh].filter((t) => !picked.includes(t)).slice(0, count - picked.length))

  // Новые треки вставляем вразброс, а не в конец
  const ordered = picked.slice(0, count).sort(() => Math.random() - 0.5)
  return spreadArtists(ordered).map(({ _explore, ...t }) => { void _explore; return t })
}
