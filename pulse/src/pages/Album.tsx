import { Link, useParams } from 'react-router-dom'
import { Cover } from '../components/Cover'
import { TrackList, TrackListSkeleton } from '../components/TrackList'
import { ErrorState, Page, PlayAllButton } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useCoverColors } from '../hooks/useCoverColors'
import { useTr } from '../i18n'
import { formatTime } from '../lib/format'
import { jamendo } from '../lib/jamendo'
import { usePlayer } from '../store/player'

export default function Album() {
  const { id = '' } = useParams()
  const L = useTr()
  const res = useAsync((signal) => jamendo.album(id, signal), [id])
  const colors = useCoverColors(res.data?.album.cover)
  const playTracks = usePlayer((s) => s.playTracks)
  const total = res.data?.tracks.reduce((s, t) => s + t.duration, 0) ?? 0

  return (
    <div>
      <header className="relative px-8 pb-8 pt-12 transition-[background] duration-700" style={{ background: `linear-gradient(180deg, ${colors.primary}, var(--bg))` }}>
        <div className="mx-auto flex max-w-[1400px] items-end gap-7">
          {res.data ? <Cover src={res.data.album.cover} className="size-52 shadow-[0_24px_60px_rgba(0,0,0,.45)]" rounded="rounded-2xl" /> : <div className="skeleton size-52 rounded-2xl" />}
          <div className="min-w-0 pb-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/80">{L('Альбом', 'Album')}</p>
            <h1 className="mt-1 line-clamp-2 text-[44px] font-extrabold leading-tight tracking-tight text-white drop-shadow">{res.data?.album.title ?? '…'}</h1>
            {res.data && (
              <p className="mt-2 text-[14px] text-white/85">
                <Link to={`/artist/${res.data.album.artistId}`} className="font-bold hover:underline">{res.data.album.artist}</Link>
                {res.data.album.releaseDate && <> · {res.data.album.releaseDate.slice(0, 4)}</>}
                {' · '}{res.data.tracks.length} {L('тр.', 'tracks')}, {formatTime(total)}
              </p>
            )}
            <div className="mt-5"><PlayAllButton onClick={() => res.data && playTracks(res.data.tracks)} disabled={!res.data?.tracks.length} /></div>
          </div>
        </div>
      </header>
      <Page className="pt-4">
        {res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : res.loading && !res.data ? <TrackListSkeleton /> : <TrackList tracks={res.data?.tracks ?? []} showAlbum={false} />}
      </Page>
    </div>
  )
}
