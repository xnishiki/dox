import { ListMusic } from 'lucide-react'
import { cn } from '../lib/format'
import type { Playlist } from '../store/playlists'
import { Cover } from './Cover'

/** Своя обложка плейлиста или автоматический коллаж из обложек первых 4 разных альбомов */
export function PlaylistCover({ playlist, className, rounded = 'rounded-xl' }: { playlist: Pick<Playlist, 'cover' | 'tracks' | 'name'>; className?: string; rounded?: string }) {
  if (playlist.cover) return <Cover src={playlist.cover} className={cn('size-full', className)} rounded={rounded} />
  const covers = [...new Set(playlist.tracks.map((t) => t.cover).filter(Boolean) as string[])].slice(0, 4)
  if (covers.length >= 4) {
    return (
      <div className={cn('grid size-full grid-cols-2 grid-rows-2 overflow-hidden', rounded, className)}>
        {covers.map((c) => <Cover key={c} src={c} className="size-full" rounded="rounded-none" />)}
      </div>
    )
  }
  if (covers.length > 0) return <Cover src={covers[0]} className={cn('size-full', className)} rounded={rounded} />
  return (
    <div className={cn('grid size-full place-items-center bg-gradient-to-br from-[#2a2320] to-[#1a1a20] text-sun', rounded, className)}>
      <ListMusic className="size-2/5" strokeWidth={1.5} />
    </div>
  )
}
