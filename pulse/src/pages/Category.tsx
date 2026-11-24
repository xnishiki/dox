import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AlbumCard, ArtistCard, Shelf, ShelfSkeleton } from '../components/Cards'
import { TrackList, TrackListSkeleton } from '../components/TrackList'
import { ErrorState, Page, PlayAllButton, SectionHeader, Segmented } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useT, useTr } from '../i18n'
import { playAlbum } from '../lib/actions'
import { categoryById } from '../lib/categories'
import { jamendo } from '../lib/jamendo'
import type { Period } from '../lib/types'
import { usePlayer } from '../store/player'

export default function Category() {
  const { id = '' } = useParams()
  const c = categoryById(id)
  const t = useT()
  const L = useTr()
  const [period, setPeriod] = useState<Period>('month')
  const top = useAsync((signal) => (c ? jamendo.popularTracks({ period, limit: 50, ...c.query }, signal) : Promise.resolve([])), [id, period])
  const collections = useAsync((signal) => (c ? jamendo.genreCollections(c.query, signal) : Promise.resolve({ albums: [], artists: [] })), [id])
  const playTracks = usePlayer((s) => s.playTracks)
  if (!c) return <Navigate to="/categories" replace />

  return (
    <div>
      <header className="relative overflow-hidden px-8 pb-8 pt-14" style={{ background: `linear-gradient(160deg, ${c.colors[0]}, ${c.colors[1]} 70%, var(--bg))` }}>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
        <div className="relative mx-auto max-w-[1400px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/80">{c.kind === 'genre' ? L('Жанр', 'Genre') : L('Настроение', 'Mood')}</p>
          <h1 className="mt-1 text-[56px] font-extrabold leading-none tracking-tight text-white drop-shadow">{L(c.ru, c.en)}</h1>
          <div className="mt-6">
            <PlayAllButton onClick={() => top.data && playTracks(top.data)} disabled={!top.data?.length} />
          </div>
        </div>
      </header>

      <Page className="pt-2">
        <section className="mb-10">
          <SectionHeader title={L('Популярные треки', 'Popular tracks')}>
            <Segmented value={period} onChange={setPeriod} options={[
              { value: 'week', label: t('period.week') },
              { value: 'month', label: t('period.month') },
              { value: 'total', label: t('period.total') },
            ]} />
          </SectionHeader>
          {top.error ? <ErrorState error={top.error} onRetry={top.reload} /> : top.loading && !top.data ? <TrackListSkeleton /> : (
            top.data?.length ? <TrackList tracks={top.data.slice(0, 15)} /> : <p className="py-8 text-center text-muted">{L('Пока ничего нет', 'Nothing here yet')}</p>
          )}
        </section>

        {collections.data?.albums.length ? (
          <Shelf title={L('Альбомы', 'Albums')}>
            {collections.data.albums.map((a) => <AlbumCard key={a.id} album={a} onPlay={() => playAlbum(a.id)} />)}
          </Shelf>
        ) : collections.loading ? <ShelfSkeleton title={L('Альбомы', 'Albums')} /> : null}

        {collections.data?.artists.length ? (
          <Shelf title={L('Исполнители', 'Artists')}>
            {collections.data.artists.map((a) => <ArtistCard key={a.id} artist={a} subtitle={L('Исполнитель', 'Artist')} />)}
          </Shelf>
        ) : collections.loading ? <ShelfSkeleton title={L('Исполнители', 'Artists')} round /> : null}
      </Page>
    </div>
  )
}
