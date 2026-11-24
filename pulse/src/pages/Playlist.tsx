import { Reorder, useDragControls } from 'framer-motion'
import { Download, GripVertical, Globe, Link2, Lock, LogOut, MoreHorizontal, Pencil, Share2, Shuffle, Trash2, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cover } from '../components/Cover'
import { PlaylistCover } from '../components/PlaylistCover'
import { PlayingBars } from '../components/PlayingBars'
import { openTrackMenu, TrackList, TrackListSkeleton } from '../components/TrackList'
import { ErrorState, Page, PlayAllButton } from '../components/ui'
import { useCoverColors } from '../hooks/useCoverColors'
import { useTr } from '../i18n'
import { cn, formatTime } from '../lib/format'
import type { Track } from '../lib/types'
import { useAuth } from '../store/auth'
import { usePlayer } from '../store/player'
import { canEdit, exportPlaylist, usePlaylists, type Playlist as PL } from '../store/playlists'
import { useUi } from '../store/ui'
import * as remote from '../sync/playlists-remote'
import { syncNow } from '../sync/sync'

type Row = Track & { key: string }

function EditableRow({ row, index, playlistId, onPlay, isCurrent, playing }: { row: Row; index: number; playlistId: string; onPlay: () => void; isCurrent: boolean; playing: boolean }) {
  const controls = useDragControls()
  const removeAt = usePlaylists((s) => s.removeAt)
  const L = useTr()
  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.01, boxShadow: '0 14px 34px rgba(0,0,0,.35)', zIndex: 5 }}
      className={cn('group grid h-14 grid-cols-[24px_32px_minmax(0,4fr)_minmax(0,3fr)_auto] items-center gap-3 rounded-xl bg-bg px-2 hover:bg-surface', isCurrent && 'bg-surface')}
      onDoubleClick={onPlay}
      onContextMenu={(e) => { e.preventDefault(); useUi.getState().openContextMenu({ x: e.clientX, y: e.clientY, track: row, playlistId, index }) }}
    >
      <button className="grid h-full cursor-grab touch-none place-items-center text-faint opacity-0 group-hover:opacity-100 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)} aria-label={L('Перетащить', 'Drag')}>
        <GripVertical size={16} />
      </button>
      <button className="grid size-8 place-items-center text-[13px] tabular-nums text-muted" onClick={onPlay}>
        {isCurrent ? <PlayingBars paused={!playing} /> : index + 1}
      </button>
      <div className="flex min-w-0 items-center gap-3">
        <Cover src={row.cover} className="size-10" rounded="rounded-md" />
        <div className="min-w-0">
          <div className={cn('truncate text-[14px] font-semibold', isCurrent && 'text-sun')}>{row.title}</div>
          <div className="truncate text-[13px] text-muted">{row.artist}</div>
        </div>
      </div>
      <div className="truncate text-[13px] text-muted max-[1000px]:hidden">{row.album}</div>
      <div className="flex items-center gap-1">
        <span className="w-11 text-right text-[13px] tabular-nums text-muted">{formatTime(row.duration)}</span>
        <button className="grid size-8 place-items-center rounded-full text-muted opacity-0 hover:text-[#ff6369] group-hover:opacity-100" onClick={() => removeAt(playlistId, index)} aria-label={L('Убрать из плейлиста', 'Remove from playlist')}>
          <X size={16} />
        </button>
        <button className="grid size-8 place-items-center rounded-full text-muted opacity-0 hover:text-fg group-hover:opacity-100" onClick={(e) => openTrackMenu(e, row)} aria-label="Ещё">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </Reorder.Item>
  )
}

function EditableList({ p }: { p: PL }) {
  const setTracks = usePlaylists((s) => s.setTracks)
  const playTracks = usePlayer((s) => s.playTracks)
  const currentId = usePlayer((s) => s.queue[s.index]?.id)
  const playing = usePlayer((s) => s.playing)
  const rows = useMemo<Row[]>(() => p.tracks.map((t, i) => ({ ...t, key: `${t.id}-${i}` })), [p.tracks])
  const [order, setOrder] = useState(rows)
  const dragging = useRef(false)
  useEffect(() => { if (!dragging.current) setOrder(rows) }, [rows])
  return (
    <Reorder.Group
      axis="y"
      values={order}
      onReorder={(v) => { dragging.current = true; setOrder(v) }}
      onPointerUp={() => {
        if (!dragging.current) return
        dragging.current = false
        if (order.some((r, i) => r.key !== rows[i]?.key)) setTracks(p.id, order)
      }}
      className="flex flex-col"
    >
      {order.map((row, i) => (
        <EditableRow key={row.key} row={row} index={i} playlistId={p.id} isCurrent={row.id === currentId} playing={playing} onPlay={() => playTracks(order, i)} />
      ))}
    </Reorder.Group>
  )
}

function Menu({ p, onClose }: { p: PL; onClose: () => void }) {
  const L = useTr()
  const navigate = useNavigate()
  const remove = usePlaylists((s) => s.remove)
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium hover:bg-hover'
  const isOwner = p.role === 'owner'
  const confirmText = isOwner ? L(`Удалить плейлист «${p.name}»?`, `Delete “${p.name}”?`) : p.role === 'editor' ? L('Выйти из совместного плейлиста?', 'Leave this playlist?') : L('Отписаться от плейлиста?', 'Unfollow this playlist?')
  return (
    <div className="absolute left-0 top-12 z-30 w-60 rounded-xl border border-line bg-elev p-1.5 shadow-soft" onMouseLeave={onClose}>
      <button className={item} onClick={() => { exportPlaylist(p); onClose() }}><Download size={16} /> {L('Экспорт в .json', 'Export to .json')}</button>
      <div className="my-1 h-px bg-line" />
      <button className={cn(item, 'text-[#ff6369]')} onClick={() => { if (confirm(confirmText)) { remove(p.id); navigate('/library') } onClose() }}>
        {isOwner ? <><Trash2 size={16} /> {L('Удалить', 'Delete')}</> : p.role === 'editor' ? <><LogOut size={16} /> {L('Выйти из плейлиста', 'Leave')}</> : <><UserCheck size={16} /> {L('Отписаться', 'Unfollow')}</>}
      </button>
    </div>
  )
}

export default function Playlist() {
  const { id = '' } = useParams()
  const L = useTr()
  const local = usePlaylists((s) => s.get(id))
  const user = useAuth((s) => s.user)
  const openDialog = useUi((s) => s.openDialog)
  const showToast = useUi((s) => s.showToast)
  const playTracks = usePlayer((s) => s.playTracks)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const [viewed, setViewed] = useState<PL | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [menu, setMenu] = useState(false)

  // Плейлиста нет в медиатеке — пробуем открыть с сервера (публичный или «по ссылке»)
  useEffect(() => {
    setViewed(null); setLoadError(null)
    if (local) return
    remote.fetchPlaylist(id, user?.id).then((p) => (p ? setViewed(p) : setLoadError(new Error(L('Плейлист не найден или закрыт', 'Playlist not found or private'))))).catch((e) => setLoadError(e))
  }, [id, !!local, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = local ?? viewed
  const colors = useCoverColors(p?.cover ?? p?.tracks.find((t) => t.cover)?.cover)
  if (!p) {
    return <Page>{loadError ? <ErrorState error={loadError} /> : <TrackListSkeleton />}</Page>
  }

  const editable = !!local && canEdit(p)
  const isOwner = !!local && p.role === 'owner'
  const total = p.tracks.reduce((s, t) => s + (t.duration || 0), 0)
  const VisIcon = p.visibility === 'public' ? Globe : p.visibility === 'link' ? Link2 : Lock

  const followIt = async () => {
    if (!user) return openDialog({ type: 'auth' })
    try {
      await remote.follow(p.id, user.id)
      await syncNow()
      showToast(L('Плейлист в твоей медиатеке', 'Added to your library'))
    } catch (err) { showToast((err as Error).message) }
  }

  return (
    <div>
      <header className="relative px-8 pb-7 pt-12 transition-[background] duration-700" style={{ background: `linear-gradient(180deg, ${colors.primary}, var(--bg))` }}>
        <div className="mx-auto flex max-w-[1400px] items-end gap-7">
          <button
            className={cn('group relative size-52 shrink-0 overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,.45)]', !isOwner && 'cursor-default')}
            onClick={() => isOwner && openDialog({ type: 'playlist', id: p.id })}
            aria-label={L('Изменить обложку', 'Change cover')}
          >
            <PlaylistCover playlist={p} rounded="rounded-2xl" />
            {isOwner && <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><Pencil size={28} /></span>}
          </button>
          <div className="min-w-0 pb-1">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white/80">
              <VisIcon size={13} /> {p.collaborative ? L('Совместный плейлист', 'Collaborative playlist') : L('Плейлист', 'Playlist')}
            </p>
            <h1 className="mt-1 line-clamp-2 text-[46px] font-extrabold leading-tight tracking-tight text-white drop-shadow">{p.name}</h1>
            {p.description && <p className="mt-1 line-clamp-2 max-w-2xl text-[14px] text-white/80">{p.description}</p>}
            <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-white/85">
              {p.ownerName && <b>{p.ownerName}</b>}
              {p.ownerName && ' · '}
              {p.tracks.length} {L('тр.', 'tracks')}{total > 0 && `, ${formatTime(total)}`}
              {p.role === 'editor' && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-mint/20 px-2 py-0.5 text-[11px] font-bold text-mint"><Users size={12} /> {L('ты соавтор', 'you collaborate')}</span>}
              {local?.dirty && user && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">{L('не синхронизирован', 'not synced')}</span>}
            </p>
          </div>
        </div>
      </header>

      <Page className="pt-4">
        <div className="relative mb-5 flex items-center gap-2">
          <PlayAllButton onClick={() => playTracks(p.tracks)} disabled={!p.tracks.length} />
          <button className="grid size-10 place-items-center rounded-full bg-surface text-muted hover:text-fg" onClick={() => { if (!usePlayer.getState().shuffle) toggleShuffle(); playTracks(p.tracks, Math.floor(Math.random() * p.tracks.length)) }} disabled={!p.tracks.length} aria-label={L('Перемешать', 'Shuffle')} title={L('Перемешать', 'Shuffle')}>
            <Shuffle size={18} />
          </button>
          {local ? (
            <>
              {isOwner && (
                <button className="grid size-10 place-items-center rounded-full bg-surface text-muted hover:text-fg" onClick={() => openDialog({ type: 'playlist', id: p.id })} aria-label={L('Редактировать', 'Edit')} title={L('Редактировать', 'Edit')}>
                  <Pencil size={17} />
                </button>
              )}
              <button className="grid size-10 place-items-center rounded-full bg-surface text-muted hover:text-fg" onClick={() => openDialog({ type: 'share', id: p.id })} aria-label={L('Поделиться', 'Share')} title={L('Поделиться', 'Share')}>
                <Share2 size={17} />
              </button>
              <div className="relative">
                <button className="grid size-10 place-items-center rounded-full bg-surface text-muted hover:text-fg" onClick={() => setMenu((v) => !v)} aria-label="Ещё">
                  <MoreHorizontal size={18} />
                </button>
                {menu && <Menu p={p} onClose={() => setMenu(false)} />}
              </div>
            </>
          ) : (
            <button onClick={followIt} className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-bold hover:bg-surface">
              <UserPlus size={16} /> {L('Подписаться', 'Follow')}
            </button>
          )}
        </div>

        {p.tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line py-14 text-center text-[14px] text-muted">
            {editable
              ? L('Плейлист пуст. Добавляй треки через правый клик → «Добавить в плейлист».', 'Empty. Right-click any track → “Add to playlist”.')
              : L('В плейлисте пока нет треков', 'No tracks yet')}
          </div>
        ) : editable ? (
          <EditableList p={p} />
        ) : (
          <TrackList tracks={p.tracks} />
        )}
      </Page>
    </div>
  )
}
