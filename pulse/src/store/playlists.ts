import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '../lib/types'

export type Visibility = 'private' | 'link' | 'public'
export type PlaylistRole = 'owner' | 'editor' | 'follower'

export interface Playlist {
  id: string
  ownerId: string | null
  ownerName?: string
  name: string
  description: string
  /** Своя обложка (JPEG data URL); без неё показывается коллаж из 4 обложек */
  cover?: string | null
  visibility: Visibility
  collaborative: boolean
  shareCode: string
  tracks: Track[]
  createdAt: number
  updatedAt: number
  role: PlaylistRole
  /** Есть локальные изменения, ещё не отправленные на сервер */
  dirty?: boolean
  /** Удалён локально, ждёт удаления на сервере */
  deleted?: boolean
  /** Хотя бы раз был сохранён на сервере */
  remote?: boolean
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeShareCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return 'PULSE-' + [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** Без служебных полей очереди — в плейлисте хранится «чистый» трек */
const clean = (t: Track): Track => {
  const { id, title, artist, artistId, album, albumId, cover, duration, src, source, genres, tags } = t
  return { id, title, artist, artistId, album, albumId, cover, duration, src, source, genres, tags }
}

let onChange: (() => void) | null = null
/** Модуль синхронизации подписывается сюда, чтобы отправлять изменения */
export const setPlaylistChangeHandler = (fn: () => void) => { onChange = fn }

interface PlaylistsState {
  playlists: Playlist[]
  get: (id: string) => Playlist | undefined
  visible: () => Playlist[]
  create: (init?: Partial<Pick<Playlist, 'name' | 'description' | 'tracks' | 'cover'>>, ownerId?: string | null) => Playlist
  update: (id: string, patch: Partial<Pick<Playlist, 'name' | 'description' | 'cover' | 'visibility' | 'collaborative'>>) => void
  addTracks: (id: string, tracks: Track[]) => number
  removeAt: (id: string, index: number) => void
  setTracks: (id: string, tracks: Track[]) => void
  remove: (id: string) => void
  /** Внутреннее, для синхронизации */
  _replace: (list: Playlist[]) => void
  _patch: (id: string, patch: Partial<Playlist>) => void
}

export const usePlaylists = create<PlaylistsState>()(
  persist(
    (set, get) => {
      const touch = (id: string, fn: (p: Playlist) => Partial<Playlist>) => {
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, ...fn(p), updatedAt: Date.now(), dirty: true } : p)) }))
        onChange?.()
      }
      return {
        playlists: [],
        get: (id) => get().playlists.find((p) => p.id === id && !p.deleted),
        visible: () => get().playlists.filter((p) => !p.deleted),

        create: (init = {}, ownerId = null) => {
          const now = Date.now()
          const p: Playlist = {
            id: crypto.randomUUID(),
            ownerId,
            name: init.name?.trim() || `Мой плейлист №${get().playlists.filter((x) => x.role === 'owner' && !x.deleted).length + 1}`,
            description: init.description ?? '',
            cover: init.cover ?? null,
            visibility: 'private',
            collaborative: false,
            shareCode: makeShareCode(),
            tracks: (init.tracks ?? []).map(clean),
            createdAt: now,
            updatedAt: now,
            role: 'owner',
            dirty: true,
          }
          set((s) => ({ playlists: [p, ...s.playlists] }))
          onChange?.()
          return p
        },

        update: (id, patch) => touch(id, () => patch),

        addTracks: (id, tracks) => {
          const p = get().get(id)
          if (!p) return 0
          const existing = new Set(p.tracks.map((t) => t.id))
          const fresh = tracks.filter((t) => !existing.has(t.id)).map(clean)
          if (fresh.length) touch(id, (pl) => ({ tracks: [...pl.tracks, ...fresh] }))
          return fresh.length
        },

        removeAt: (id, index) => touch(id, (p) => ({ tracks: p.tracks.filter((_, i) => i !== index) })),
        setTracks: (id, tracks) => touch(id, () => ({ tracks: tracks.map(clean) })),

        remove: (id) => {
          const p = get().playlists.find((x) => x.id === id)
          if (!p) return
          // Никогда не синхронизированный плейлист просто удаляем, иначе — помечаем для сервера
          if (!p.remote) set((s) => ({ playlists: s.playlists.filter((x) => x.id !== id) }))
          else set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? { ...x, deleted: true, dirty: true } : x)) }))
          onChange?.()
        },

        _replace: (playlists) => set({ playlists }),
        _patch: (id, patch) => set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      }
    },
    { name: 'pulse.playlists' },
  ),
)

/** Можно ли добавлять треки в этот плейлист */
export const canEdit = (p: Playlist) => p.role === 'owner' || (p.role === 'editor' && p.collaborative)

// ---------- Экспорт / импорт ----------
export function exportPlaylist(p: Playlist) {
  const data = {
    format: 'pulse-playlist',
    version: 1,
    name: p.name,
    description: p.description,
    cover: p.cover ?? null,
    exportedAt: new Date().toISOString(),
    tracks: p.tracks,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${p.name.replace(/[\\/:*?"<>|]+/g, '_')}.pulse.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export async function importPlaylistFile(file: File, ownerId: string | null): Promise<Playlist> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Файл слишком большой')
  let data: { format?: string; name?: unknown; description?: unknown; cover?: unknown; tracks?: unknown }
  try { data = JSON.parse(await file.text()) } catch { throw new Error('Это не JSON-файл') }
  if (data.format !== 'pulse-playlist' || !Array.isArray(data.tracks)) throw new Error('Это не плейлист Pulse')
  const tracks = (data.tracks as Track[]).filter(
    (t) => t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.src === 'string' && (t.source === 'jamendo' || t.source === 'local'),
  )
  const cover = typeof data.cover === 'string' && data.cover.startsWith('data:image/') ? data.cover : null
  return usePlaylists.getState().create(
    { name: String(data.name ?? 'Импорт').slice(0, 100), description: String(data.description ?? '').slice(0, 500), tracks, cover },
    ownerId,
  )
}

// ---------- Обложка: уменьшаем картинку до 512×512 JPEG ----------
export async function imageFileToCover(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Нужна картинка')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Не удалось открыть картинку'))
      i.src = url
    })
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const s = Math.min(img.width, img.height)
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
