import { getSupabase } from '../lib/supabase'
import type { Track } from '../lib/types'
import type { Playlist, PlaylistRole, Visibility } from '../store/playlists'

interface Row {
  id: string
  owner_id: string
  name: string
  description: string
  cover_data: string | null
  visibility: Visibility
  collaborative: boolean
  share_code: string
  tracks: Track[]
  created_at: string
  updated_at: string
  profiles?: { username: string } | null
}

const SELECT = 'id, owner_id, name, description, cover_data, visibility, collaborative, share_code, tracks, created_at, updated_at, profiles!playlists_owner_id_fkey(username)'

export function rowToPlaylist(r: Row, role: PlaylistRole): Playlist {
  return {
    id: r.id,
    ownerId: r.owner_id,
    ownerName: r.profiles?.username,
    name: r.name,
    description: r.description,
    cover: r.cover_data,
    visibility: r.visibility,
    collaborative: r.collaborative,
    shareCode: r.share_code,
    tracks: Array.isArray(r.tracks) ? r.tracks : [],
    createdAt: Date.parse(r.created_at),
    updatedAt: Date.parse(r.updated_at),
    role,
    remote: true,
    dirty: false,
  }
}

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Аккаунты не настроены')
  return c
}

/** Все плейлисты пользователя: свои, где соавтор, и на которые подписан */
export async function fetchMine(uid: string): Promise<Playlist[]> {
  const c = sb()
  const [owned, members, follows] = await Promise.all([
    c.from('playlists').select(SELECT).eq('owner_id', uid),
    c.from('playlist_members').select('playlist_id').eq('user_id', uid),
    c.from('playlist_follows').select('playlist_id').eq('user_id', uid),
  ])
  if (owned.error) throw owned.error
  if (members.error) throw members.error
  if (follows.error) throw follows.error
  const memberIds = (members.data ?? []).map((m) => m.playlist_id as string)
  const followIds = (follows.data ?? []).map((m) => m.playlist_id as string)
  const others = memberIds.length + followIds.length
    ? await c.from('playlists').select(SELECT).in('id', [...memberIds, ...followIds])
    : { data: [], error: null }
  if (others.error) throw others.error
  const out = (owned.data as unknown as Row[]).map((r) => rowToPlaylist(r, 'owner'))
  for (const r of (others.data ?? []) as unknown as Row[]) {
    if (r.owner_id === uid) continue
    out.push(rowToPlaylist(r, memberIds.includes(r.id) ? 'editor' : 'follower'))
  }
  return out
}

export async function fetchPlaylist(id: string, uid?: string): Promise<Playlist | null> {
  const { data, error } = await sb().from('playlists').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as unknown as Row
  return rowToPlaylist(r, r.owner_id === uid ? 'owner' : 'follower')
}

export async function pushOwned(p: Playlist, uid: string) {
  const { error } = await sb().from('playlists').upsert({
    id: p.id,
    owner_id: uid,
    name: p.name,
    description: p.description,
    cover_data: p.cover ?? null,
    visibility: p.visibility,
    collaborative: p.collaborative,
    share_code: p.shareCode,
    tracks: p.tracks,
    updated_at: new Date(p.updatedAt).toISOString(),
  })
  if (error) throw error
}

/** Соавтор может менять только список треков */
export async function pushTracks(p: Playlist) {
  const { error } = await sb().from('playlists').update({ tracks: p.tracks, updated_at: new Date(p.updatedAt).toISOString() }).eq('id', p.id)
  if (error) throw error
}

export async function appendTracks(id: string, tracks: Track[]) {
  const { error } = await sb().rpc('append_tracks', { pid: id, new_tracks: tracks })
  if (error) throw error
}

export async function deleteOwned(id: string) {
  const { error } = await sb().from('playlists').delete().eq('id', id)
  if (error) throw error
}

export async function leave(id: string, uid: string) {
  const { error } = await sb().from('playlist_members').delete().eq('playlist_id', id).eq('user_id', uid)
  if (error) throw error
}

export async function follow(id: string, uid: string) {
  const { error } = await sb().from('playlist_follows').upsert({ playlist_id: id, user_id: uid })
  if (error) throw error
}

export async function unfollow(id: string, uid: string) {
  const { error } = await sb().from('playlist_follows').delete().eq('playlist_id', id).eq('user_id', uid)
  if (error) throw error
}

export async function joinByCode(code: string): Promise<{ playlistId: string; role: PlaylistRole }> {
  const { data, error } = await sb().rpc('join_by_code', { code: code.trim().toUpperCase() })
  if (error) throw new Error(error.message)
  const row = (Array.isArray(data) ? data[0] : data) as { playlist_id: string; role: PlaylistRole }
  return { playlistId: row.playlist_id, role: row.role }
}

export async function inviteMember(id: string, username: string) {
  const { error } = await sb().rpc('invite_member', { pid: id, member_username: username })
  if (error) throw new Error(error.message)
}

export async function listMembers(id: string): Promise<Array<{ userId: string; username: string }>> {
  const { data, error } = await sb().from('playlist_members').select('user_id, profiles(username)').eq('playlist_id', id)
  if (error) throw error
  return (data ?? []).map((m) => ({ userId: m.user_id as string, username: (m.profiles as unknown as { username: string } | null)?.username ?? '—' }))
}

export async function removeMember(id: string, userId: string) {
  const { error } = await sb().from('playlist_members').delete().eq('playlist_id', id).eq('user_id', userId)
  if (error) throw error
}

/** Публичные плейлисты (поиск по названию). Без настроенного Supabase — пустой список. */
export async function searchPublicPlaylists(q: string, signal?: AbortSignal, limit = 24): Promise<Playlist[]> {
  const c = getSupabase()
  if (!c) return []
  let query = c.from('playlists').select(SELECT).eq('visibility', 'public').order('updated_at', { ascending: false }).limit(limit)
  const text = q.trim().replace(/[%_,()]/g, ' ')
  if (text) query = query.ilike('name', `%${text}%`)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) return []
  return (data as unknown as Row[]).map((r) => rowToPlaylist(r, 'follower'))
}
