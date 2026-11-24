import { User } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { AlbumCard, CardGrid } from '../components/Cards'
import { Cover } from '../components/Cover'
import { TrackList, TrackListSkeleton } from '../components/TrackList'
import { ErrorState, Page, PlayAllButton } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useCoverColors } from '../hooks/useCoverColors'
import { useTr } from '../i18n'
import { playAlbum } from '../lib/actions'
import { jamendo } from '../lib/jamendo'
import { usePlayer } from '../store/player'

export default function Artist() {
  const { id = '' } = useParams()
  const L = useTr()
  const res = useAsync((signal) => jamendo.artist(id, signal), [id])
  const colors = useCoverColors(res.data?.artist.image || res.data?.albums[0]?.cover)
  const playTracks = usePlayer((s) => s.playTracks)

  return (
    <div>
      <header className="relative px-8 pb-8 pt-12 transition-[background] duration-700" style={{ background: `linear-gradient(180deg, ${colors.primary}, var(--bg))` }}>
        <div className="mx-auto flex max-w-[1400px] items-end gap-7">
          {res.data?.artist.image ? (
            <Cover src={res.data.artist.image} className="size-52 shadow-[0_24px_60px_rgba(0,0,0,.45)]" rounded="rounded-full" />
          ) : (
            <div className="grid size-52 place-items-center rounded-full bg-elev text-faint shadow-soft"><User size={64} /></div>
          )}
          <div className="min-w-0 pb-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/80">{L('Исполнитель', 'Artist')}</p>
            <h1 className="mt-1 line-clamp-2 text-[52px] font-extrabold leading-tight tracking-tight text-white drop-shadow">{res.data?.artist.name ?? '…'}</h1>
            <div className="mt-5"><PlayAllButton onClick={() => res.data && playTracks(res.data.tracks)} disabled={!res.data?.tracks.length} /></div>
          </div>
        </div>
      </header>
      <Page className="pt-4">
        {res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : res.loading && !res.data ? <TrackListSkeleton /> : res.data && (
          <>
            <h2 className="mb-2 text-[22px] font-extrabold">{L('Популярные треки', 'Popular tracks')}</h2>
            <TrackList tracks={res.data.tracks.slice(0, 10)} />
            {res.data.albums.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-2 text-[22px] font-extrabold">{L('Альбомы', 'Albums')}</h2>
                <CardGrid>{res.data.albums.map((a) => <AlbumCard key={a.id} album={{ ...a, artist: a.releaseDate?.slice(0, 4) ?? a.artist }} onPlay={() => playAlbum(a.id)} />)}</CardGrid>
              </section>
            )}
          </>
        )}
      </Page>
    </div>
  )
}
