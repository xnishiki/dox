import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Play, User } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/format'
import type { Album, Artist } from '../lib/types'
import { Cover } from './Cover'

function HoverPlay({ onPlay }: { onPlay?: () => void }) {
  if (!onPlay) return null
  return (
    <motion.button
      className="bg-brand absolute bottom-2 right-2 grid size-11 translate-y-2 place-items-center rounded-full text-[#1b1208] opacity-0 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
      whileTap={{ scale: 0.9 }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlay() }}
      aria-label="Играть"
    >
      <Play size={18} className="translate-x-[1px] fill-current" />
    </motion.button>
  )
}

export function MediaCard({ to, cover, title, subtitle, onPlay, round, coverNode }: {
  to: string
  cover?: string
  title: string
  subtitle?: string
  onPlay?: () => void
  round?: boolean
  coverNode?: ReactNode
}) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }} className="group w-full">
      <Link to={to} className="block rounded-2xl p-2.5 transition-colors hover:bg-surface">
        <div className={cn('relative aspect-square w-full overflow-hidden shadow-soft', round ? 'rounded-full' : 'rounded-xl')}>
          {coverNode ?? (
            round && !cover ? (
              <div className="grid size-full place-items-center bg-elev text-faint"><User size={40} /></div>
            ) : (
              <Cover src={cover} className="size-full" rounded={round ? 'rounded-full' : 'rounded-xl'} />
            )
          )}
          {!round && <HoverPlay onPlay={onPlay} />}
        </div>
        <div className={cn('mt-2.5 min-w-0', round && 'text-center')}>
          <div className="truncate text-[14px] font-bold">{title}</div>
          {subtitle && <div className="truncate text-[12.5px] text-muted">{subtitle}</div>}
        </div>
      </Link>
    </motion.div>
  )
}

export const AlbumCard = ({ album, onPlay }: { album: Album; onPlay?: () => void }) => (
  <MediaCard to={`/album/${album.id}`} cover={album.cover} title={album.title} subtitle={album.artist} onPlay={onPlay} />
)

export const ArtistCard = ({ artist, subtitle }: { artist: Artist; subtitle?: string }) => (
  <MediaCard to={`/artist/${artist.id}`} cover={artist.image} title={artist.name} subtitle={subtitle} round />
)

/** Горизонтальная полка с прокруткой стрелками */
export function Shelf({ title, children, action }: { title: ReactNode; children: ReactNode; action?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="mb-9">
      <div className="mb-2 flex items-end justify-between gap-3 px-0.5">
        <h2 className="text-[22px] font-extrabold tracking-tight">{title}</h2>
        <div className="flex items-center gap-1.5">
          {action}
          <button className="grid size-8 place-items-center rounded-full bg-surface text-muted hover:text-fg" onClick={() => scroll(-1)} aria-label="Назад"><ChevronLeft size={18} /></button>
          <button className="grid size-8 place-items-center rounded-full bg-surface text-muted hover:text-fg" onClick={() => scroll(1)} aria-label="Вперёд"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div ref={ref} className="no-scrollbar -mx-2.5 grid snap-x grid-flow-col overflow-x-auto [grid-auto-columns:calc((100%-0px)/6)] max-[1250px]:[grid-auto-columns:calc(100%/5)] max-[1050px]:[grid-auto-columns:calc(100%/4)]">
        {children}
      </div>
    </section>
  )
}

export function ShelfSkeleton({ title, round }: { title: string; round?: boolean }) {
  return (
    <section className="mb-9">
      <h2 className="mb-2 text-[22px] font-extrabold tracking-tight">{title}</h2>
      <div className="grid grid-cols-6 max-[1250px]:grid-cols-5 max-[1050px]:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="p-2.5 max-[1250px]:[&:nth-child(6)]:hidden max-[1050px]:[&:nth-child(5)]:hidden">
            <div className={cn('skeleton aspect-square', round ? 'rounded-full' : 'rounded-xl')} />
            <div className="skeleton mt-3 h-3.5 w-3/4 rounded" />
            <div className="skeleton mt-2 h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="-mx-2.5 grid grid-cols-6 max-[1250px]:grid-cols-5 max-[1050px]:grid-cols-4">{children}</div>
}
