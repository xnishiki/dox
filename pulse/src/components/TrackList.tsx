import { motion } from 'framer-motion'
import { Heart, MoreHorizontal, Play } from 'lucide-react'
import type { MouseEvent } from 'react'
import { formatTime, cn } from '../lib/format'
import type { Track } from '../lib/types'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { useT } from '../i18n'
import { Cover } from './Cover'
import { PlayingBars } from './PlayingBars'

interface Props {
  tracks: Track[]
  showAlbum?: boolean
  /** Ограничить анимацию появления первыми N строками */
  animateFirst?: number
  /** С какого номера начинать нумерацию */
  startIndex?: number
  /** Действие для пункта контекстного меню «Убрать из плейлиста» и т. п. */
  onRemove?: (track: Track, index: number) => void
}

export function openTrackMenu(e: MouseEvent, track: Track) {
  e.preventDefault()
  e.stopPropagation()
  useUi.getState().openContextMenu({ x: e.clientX, y: e.clientY, track })
}

export function TrackList({ tracks, showAlbum = true, animateFirst = 24, startIndex = 0 }: Props) {
  const t = useT()
  const currentId = usePlayer((s) => s.queue[s.index]?.id)
  const playing = usePlayer((s) => s.playing)
  const playTracks = usePlayer((s) => s.playTracks)
  const toggle = usePlayer((s) => s.toggle)
  const liked = useLibrary((s) => s.liked)
  const toggleLike = useLibrary((s) => s.toggleLike)
  const showToast = useUi((s) => s.showToast)
  const likedIds = new Set(liked.map((x) => x.id))

  const onPlay = (i: number) => {
    if (tracks[i].id === currentId) toggle()
    else playTracks(tracks, i)
  }

  return (
    <div role="list" className="flex flex-col">
      {tracks.map((tr, i) => {
        const isCurrent = tr.id === currentId
        const isLiked = likedIds.has(tr.id)
        return (
          <motion.div
            role="listitem"
            key={`${tr.id}-${i}`}
            initial={i < animateFirst ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, animateFirst) * 0.02, ease: [0.22, 1, 0.36, 1] }}
            onDoubleClick={() => onPlay(i)}
            onContextMenu={(e) => openTrackMenu(e, tr)}
            className={cn(
              'group grid h-14 cursor-default items-center gap-3 rounded-xl px-2 transition-colors hover:bg-surface',
              showAlbum ? 'grid-cols-[32px_minmax(0,4fr)_minmax(0,3fr)_auto]' : 'grid-cols-[32px_minmax(0,1fr)_auto]',
              isCurrent && 'bg-surface',
            )}
          >
            <button className="grid size-8 place-items-center text-[13px] tabular-nums text-muted" onClick={() => onPlay(i)} aria-label={t('player.play')}>
              {isCurrent ? (
                <PlayingBars paused={!playing} className="group-hover:hidden" />
              ) : (
                <span className="group-hover:hidden">{startIndex + i + 1}</span>
              )}
              <Play size={16} className="hidden fill-fg text-fg group-hover:block" />
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <Cover src={tr.cover} className="size-10" rounded="rounded-md" />
              <div className="min-w-0">
                <div className={cn('truncate text-[14px] font-semibold', isCurrent && 'text-sun')}>{tr.title}</div>
                <div className="truncate text-[13px] text-muted">{tr.artist}</div>
              </div>
            </div>

            {showAlbum && <div className="truncate text-[13px] text-muted max-[1000px]:hidden">{tr.album}</div>}

            <div className="flex items-center gap-1">
              <button
                className={cn('grid size-8 place-items-center rounded-full transition', isLiked ? 'text-ember' : 'text-muted opacity-0 hover:text-fg group-hover:opacity-100')}
                onClick={() => {
                  toggleLike(tr)
                  showToast(t(isLiked ? 'toast.unliked' : 'toast.liked'))
                }}
                aria-label={t(isLiked ? 'player.unlike' : 'player.like')}
              >
                <Heart size={16} className={cn(isLiked && 'fill-current')} />
              </button>
              <span className="w-11 text-right text-[13px] tabular-nums text-muted">{formatTime(tr.duration)}</span>
              <button className="grid size-8 place-items-center rounded-full text-muted opacity-0 hover:text-fg group-hover:opacity-100" onClick={(e) => openTrackMenu(e, tr)} aria-label="Ещё">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 px-2">
          <div className="skeleton h-4 w-6 rounded" />
          <div className="skeleton size-10 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-3.5 w-1/3 rounded" />
            <div className="skeleton h-3 w-1/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
