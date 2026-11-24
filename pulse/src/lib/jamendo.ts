import type { Album, Artist, Period, Track } from './types'

const BASE = 'https://api.jamendo.com/v3.0'
const ENV_CLIENT_ID = import.meta.env.VITE_JAMENDO_CLIENT_ID ?? ''

// Ключ можно задать в .env при сборке или вписать в Настройках (тогда он важнее)
let clientId = ENV_CLIENT_ID
export const setJamendoClientId = (id: string | null | undefined) => { clientId = (id || '').trim() || ENV_CLIENT_ID }
export const hasJamendoKey = () => clientId.length > 0
export const hasEnvJamendoKey = () => ENV_CLIENT_ID.length > 0

export class JamendoError extends Error {}

/** mp31 — 96 кбит/с (экономно), mp32 — VBR ~192 кбит/с (высокое качество) */
export type AudioQuality = 'mp31' | 'mp32'
let quality: AudioQuality = 'mp32'
export const setJamendoQuality = (q: AudioQuality) => { quality = q }

type Params = Record<string, string | number | undefined>

// Небольшой кэш ответов: страницы открываются мгновенно при возврате назад
const cache = new Map<string, { at: number; data: unknown }>()
const TTL = 5 * 60 * 1000

async function request<T>(path: string, params: Params, signal?: AbortSignal): Promise<T[]> {
  if (!hasJamendoKey()) throw new JamendoError('Не задан ключ Jamendo')
  const url = new URL(`${BASE}/${path}/`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  const key = url.toString()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data as T[]
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new JamendoError(navigator.onLine ? 'Jamendo недоступен' : 'Нет подключения к интернету')
  }
  if (!res.ok) throw new JamendoError(`Jamendo недоступен (${res.status})`)
  const json = await res.json()
  if (json.headers?.status !== 'success') throw new JamendoError(json.headers?.error_message || 'Ошибка Jamendo')
  cache.set(key, { at: Date.now(), data: json.results })
  return json.results as T[]
}

interface RawTrack {
  id: string
  name: string
  duration: number
  artist_id: string
  artist_name: string
  album_id: string
  album_name: string
  album_image?: string
  image?: string
  audio: string
  releasedate?: string
  musicinfo?: { tags?: { genres?: string[]; instruments?: string[]; vartags?: string[] } }
}

interface RawAlbum {
  id: string
  name: string
  artist_id: string
  artist_name: string
  image: string
  releasedate?: string
  tracks?: RawTrack[]
}

interface RawArtist {
  id: string
  name: string
  image?: string
  tracks?: RawTrack[]
  albums?: RawAlbum[]
}

export function mapTrack(t: RawTrack, album?: { name: string; image: string; id: string }): Track {
  return {
    id: `jm:${t.id}`,
    title: t.name,
    artist: t.artist_name,
    artistId: t.artist_id,
    album: t.album_name || album?.name,
    albumId: t.album_id || album?.id,
    cover: t.album_image || t.image || album?.image,
    duration: Number(t.duration) || 0,
    src: t.audio,
    source: 'jamendo',
    genres: t.musicinfo?.tags?.genres ?? [],
    tags: t.musicinfo?.tags?.vartags ?? [],
  }
}

const mapAlbum = (a: RawAlbum): Album => ({
  id: a.id,
  title: a.name,
  artist: a.artist_name,
  artistId: a.artist_id,
  cover: a.image,
  releaseDate: a.releasedate,
})

const mapArtist = (a: RawArtist): Artist => ({ id: a.id, name: a.name, image: a.image || undefined })

const trackDefaults = () => ({ include: 'musicinfo', audioformat: quality, imagesize: 300 })

export interface Suggestion {
  type: 'track' | 'album' | 'artist' | 'tag'
  text: string
}

export const jamendo = {
  popularTracks(opts: { period?: Period; tags?: string; fuzzytags?: string; limit?: number; offset?: number } = {}, signal?: AbortSignal) {
    const { period = 'week', limit = 30, ...rest } = opts
    return request<RawTrack>('tracks', { ...trackDefaults(), order: `popularity_${period}`, limit, ...rest }, signal).then((r) => r.map((t) => mapTrack(t)))
  },

  newTracks(opts: { tags?: string; fuzzytags?: string; limit?: number; offset?: number } = {}, signal?: AbortSignal) {
    return request<RawTrack>('tracks', { ...trackDefaults(), order: 'releasedate_desc', boost: 'popularity_month', limit: 20, ...opts }, signal).then((r) => r.map((t) => mapTrack(t)))
  },

  /** Универсальный запрос треков — используется «Потоком» */
  tracks(params: Params, signal?: AbortSignal) {
    return request<RawTrack>('tracks', { ...trackDefaults(), ...params }, signal).then((r) => r.map((t) => mapTrack(t)))
  },

  popularAlbums(opts: { period?: Period; limit?: number } = {}, signal?: AbortSignal) {
    return request<RawAlbum>('albums', { order: `popularity_${opts.period ?? 'month'}`, limit: opts.limit ?? 12, imagesize: 300 }, signal).then((r) => r.map(mapAlbum))
  },

  newAlbums(limit = 12, signal?: AbortSignal) {
    return request<RawAlbum>('albums', { order: 'releasedate_desc', limit, imagesize: 300 }, signal).then((r) => r.map(mapAlbum))
  },

  popularArtists(opts: { period?: Period; limit?: number } = {}, signal?: AbortSignal) {
    return request<RawArtist>('artists', { order: `popularity_${opts.period ?? 'month'}`, limit: opts.limit ?? 12, hasimage: 'true' }, signal).then((r) => r.map(mapArtist))
  },

  /** Альбомы и исполнители жанра: берём популярные треки жанра и собираем уникальные альбомы/исполнителей */
  async genreCollections(tags: { tags?: string; fuzzytags?: string }, signal?: AbortSignal) {
    const tracks = await request<RawTrack>('tracks', { ...trackDefaults(), ...tags, order: 'popularity_month', limit: 100 }, signal)
    const albums = new Map<string, Album>()
    const artists = new Map<string, Artist>()
    for (const t of tracks) {
      if (t.album_id && !albums.has(t.album_id) && t.album_image)
        albums.set(t.album_id, { id: t.album_id, title: t.album_name, artist: t.artist_name, artistId: t.artist_id, cover: t.album_image })
      if (!artists.has(t.artist_id)) artists.set(t.artist_id, { id: t.artist_id, name: t.artist_name })
    }
    const artistList = [...artists.values()].slice(0, 12)
    // Фото исполнителей одним запросом
    if (artistList.length) {
      const raw = await request<RawArtist>('artists', { id: artistList.map((a) => a.id).join('+'), limit: artistList.length }, signal).catch(() => [])
      const img = new Map(raw.map((a) => [a.id, a.image]))
      artistList.forEach((a) => { a.image = img.get(a.id) || undefined })
    }
    return { albums: [...albums.values()].slice(0, 12), artists: artistList }
  },

  async album(id: string, signal?: AbortSignal) {
    const [raw] = await request<RawAlbum>('albums/tracks', { id, audioformat: quality, imagesize: 300, track_type: 'albumtrack' }, signal)
    if (!raw) throw new JamendoError('Альбом не найден')
    const meta = { id: raw.id, name: raw.name, image: raw.image }
    return {
      album: mapAlbum(raw),
      tracks: (raw.tracks ?? []).map((t) => mapTrack({ ...t, artist_id: t.artist_id ?? raw.artist_id, artist_name: t.artist_name ?? raw.artist_name, album_id: raw.id, album_name: raw.name, album_image: raw.image }, meta)),
    }
  },

  async artist(id: string, signal?: AbortSignal) {
    const [[info], tracks, albums] = await Promise.all([
      request<RawArtist>('artists', { id }, signal),
      request<RawTrack>('tracks', { ...trackDefaults(), artist_id: id, order: 'popularity_total', limit: 20 }, signal),
      request<RawAlbum>('albums', { artist_id: id, order: 'releasedate_desc', limit: 24, imagesize: 300 }, signal),
    ])
    if (!info) throw new JamendoError('Исполнитель не найден')
    return { artist: mapArtist(info), tracks: tracks.map((t) => mapTrack(t)), albums: albums.map(mapAlbum) }
  },

  async search(q: string, signal?: AbortSignal) {
    const [tracks, albums, artists] = await Promise.all([
      request<RawTrack>('tracks', { ...trackDefaults(), search: q, limit: 20, order: 'relevance' }, signal),
      request<RawAlbum>('albums', { namesearch: q, limit: 12, imagesize: 300 }, signal),
      request<RawArtist>('artists', { namesearch: q, limit: 12 }, signal),
    ])
    return { tracks: tracks.map((t) => mapTrack(t)), albums: albums.map(mapAlbum), artists: artists.map(mapArtist) }
  },

  async suggest(prefix: string, signal?: AbortSignal): Promise<Suggestion[]> {
    if (prefix.trim().length < 2) return []
    const raw = await request<{ tracks?: string[]; albums?: string[]; artists?: string[]; tags?: string[] }>(
      'autocomplete', { prefix: prefix.trim(), entity: 'tracks+albums+artists+tags', limit: 4, matchcount: 0 }, signal,
    ) as unknown as { tracks?: string[]; albums?: string[]; artists?: string[]; tags?: string[] }
    const out: Suggestion[] = []
    raw.artists?.forEach((text) => out.push({ type: 'artist', text }))
    raw.tracks?.forEach((text) => out.push({ type: 'track', text }))
    raw.albums?.forEach((text) => out.push({ type: 'album', text }))
    raw.tags?.forEach((text) => out.push({ type: 'tag', text }))
    return out.slice(0, 10)
  },
}
