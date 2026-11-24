import { create } from 'zustand'
import { getSupabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useLibrary } from '../store/library'
import { makeShareCode, setPlaylistChangeHandler, usePlaylists, type Playlist } from '../store/playlists'
import { useTaste } from '../store/taste'
import * as remote from './playlists-remote'

/**
 * Синхронизация «сначала локально»:
 * всё пишется на диск сразу, а при наличии сети и аккаунта отправляется в Supabase.
 * Конфликты решаются по времени изменения (кто позже — тот прав).
 */
interface SyncState {
  online: boolean
  syncing: boolean
  lastSync: number | null
  error: string | null
}
export const useSync = create<SyncState>()(() => ({ online: navigator.onLine, syncing: false, lastSync: null, error: null }))

let running: Promise<void> | null = null
let again = false

async function pushPlaylist(p: Playlist, uid: string) {
  const store = usePlaylists.getState()
  if (p.deleted) {
    if (p.role === 'owner') await remote.deleteOwned(p.id)
    else if (p.role === 'editor') await remote.leave(p.id, uid)
    else await remote.unfollow(p.id, uid)
    store._replace(usePlaylists.getState().playlists.filter((x) => x.id !== p.id))
    return
  }
  if (p.role === 'owner') {
    try {
      await remote.pushOwned(p, uid)
    } catch (err) {
      // Код-приглашение случайно совпал с чужим — выдаём новый и пробуем ещё раз
      if ((err as { code?: string }).code === '23505' && /share_code/.test((err as Error).message)) {
        const shareCode = makeShareCode()
        store._patch(p.id, { shareCode })
        await remote.pushOwned({ ...p, shareCode }, uid)
      } else throw err
    }
  } else if (p.role === 'editor' && p.collaborative) {
    await remote.pushTracks(p)
  }
  // Пока шёл запрос, плейлист могли снова изменить — тогда он останется «грязным»
  const now = usePlaylists.getState().playlists.find((x) => x.id === p.id)
  if (now && now.updatedAt === p.updatedAt) store._patch(p.id, { dirty: false, remote: true })
  else store._patch(p.id, { remote: true })
}

function mergeRemote(remoteList: Playlist[]) {
  const local = usePlaylists.getState().playlists
  const byId = new Map(local.map((p) => [p.id, p]))
  const remoteIds = new Set(remoteList.map((p) => p.id))
  const merged: Playlist[] = []
  for (const r of remoteList) {
    const l = byId.get(r.id)
    if (!l) merged.push(r)
    else if (l.dirty && l.updatedAt >= r.updatedAt) merged.push(l)
    else merged.push({ ...r, dirty: false })
  }
  // Локальные, которых нет на сервере: новые (ещё не отправлены) — оставляем, удалённые на сервере — убираем
  for (const l of local) if (!remoteIds.has(l.id) && (!l.remote || l.dirty)) merged.push(l)
  merged.sort((a, b) => b.updatedAt - a.updatedAt)
  usePlaylists.getState()._replace(merged)
}

async function syncUserState(uid: string) {
  const sb = getSupabase()!
  const { data, error } = await sb.from('user_state').select('liked, taste, updated_at').eq('user_id', uid).maybeSingle()
  if (error) throw error
  const lib = useLibrary.getState()
  const taste = useTaste.getState()
  const localAt = Math.max(lib.updatedAt, taste.updatedAt)
  const remoteAt = data ? Date.parse(data.updated_at) : 0
  if (data && remoteAt > localAt) {
    lib._replace(Array.isArray(data.liked) ? data.liked : [], remoteAt)
    const t = data.taste ?? {}
    taste._replace({
      events: Array.isArray(t.events) ? t.events : [],
      disliked: Array.isArray(t.disliked) ? t.disliked : [],
      prefs: t.prefs ?? taste.prefs,
      updatedAt: remoteAt,
    })
  } else if (localAt > remoteAt) {
    const { error: e2 } = await sb.from('user_state').upsert({
      user_id: uid,
      liked: lib.liked,
      taste: { events: taste.events, disliked: taste.disliked, prefs: taste.prefs },
      updated_at: new Date(localAt).toISOString(),
    })
    if (e2) throw e2
  }
}

async function doSync() {
  const user = useAuth.getState().user
  if (!user || !getSupabase() || !navigator.onLine) return
  useSync.setState({ syncing: true, error: null })
  try {
    // Плейлисты, созданные до входа, становятся плейлистами этого аккаунта
    for (const p of usePlaylists.getState().playlists) {
      if (p.role === 'owner' && p.ownerId !== user.id && !p.remote) usePlaylists.getState()._patch(p.id, { ownerId: user.id, ownerName: user.username, dirty: true })
    }
    for (const p of usePlaylists.getState().playlists.filter((x) => x.dirty)) {
      try {
        await pushPlaylist(p, user.id)
      } catch (err) {
        console.warn('Не удалось отправить плейлист', p.name, err)
      }
    }
    mergeRemote(await remote.fetchMine(user.id))
    await syncUserState(user.id)
    useSync.setState({ lastSync: Date.now() })
  } catch (err) {
    useSync.setState({ error: (err as Error).message })
  } finally {
    useSync.setState({ syncing: false })
  }
}

/** Запустить синхронизацию (повторные вызовы во время работы склеиваются в один) */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running }
  running = doSync().finally(() => {
    running = null
    if (again) { again = false; void syncNow() }
  })
  return running
}

let debounce: ReturnType<typeof setTimeout> | undefined
const scheduleSync = (ms = 1500) => { clearTimeout(debounce); debounce = setTimeout(() => void syncNow(), ms) }

export function initSync() {
  setPlaylistChangeHandler(() => scheduleSync())
  window.addEventListener('online', () => { useSync.setState({ online: true }); scheduleSync(300) })
  window.addEventListener('offline', () => useSync.setState({ online: false }))

  let prevUser: string | undefined
  useAuth.subscribe((s) => {
    const id = s.user?.id
    if (id === prevUser) return
    const wasLoggedIn = !!prevUser
    prevUser = id
    if (id) scheduleSync(100)
    else if (wasLoggedIn) {
      // После выхода убираем чужие и синхронизированные плейлисты с этого компьютера
      usePlaylists.getState()._replace(usePlaylists.getState().playlists.filter((p) => !p.remote))
    }
  })

  useLibrary.subscribe((s, prev) => { if (s.updatedAt !== prev.updatedAt) scheduleSync(4000) })
  useTaste.subscribe((s, prev) => { if (s.updatedAt !== prev.updatedAt) scheduleSync(8000) })

  // Раз в минуту подтягиваем изменения соавторов
  setInterval(() => { if (document.visibilityState === 'visible') void syncNow() }, 60_000)
}
