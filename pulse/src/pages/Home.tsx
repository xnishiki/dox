import { useState } from 'react'
import { AlbumCard, ArtistCard, Shelf, ShelfSkeleton } from '../components/Cards'
import { FlowHero } from '../components/FlowHero'
import { TrackList, TrackListSkeleton } from '../components/TrackList'
import { ErrorState, Page, PlayAllButton, SectionHeader, Segmented } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useT, useTr, type TKey } from '../i18n'
import { playAlbum } from '../lib/actions'
import { jamendo } from '../lib/jamendo'
import type { Period } from '../lib/types'
import { usePlayer } from '../store/player'

function greetingKey(): TKey {
  const h = new Date().getHours()
  return h < 5 ? 'home.night' : h < 12 ? 'home.morning' : h < 18 ? 'home.day' : 'home.evening'
}

export default function Home() {
  const t = useT()
  const L = useTr()
  const [period, setPeriod] = useState<Period>('week')
  const top = useAsync((signal) => jamendo.popularTracks({ period, limit: 30 }, signal), [period])
  const fresh = useAsync((signal) => jamendo.newTracks({ limit: 12 }, signal), [])
  const albums = useAsync((signal) => jamendo.popularAlbums({ period: 'month', limit: 18 }, signal), [])
  const artists = useAsync((signal) => jamendo.popularArtists({ period: 'month', limit: 18 }, signal), [])
  const playTracks = usePlayer((s) => s.playTracks)

  return (
    <Page>
      <p className="mb-5 text-[28px] font-extrabold tracking-tight">{t(greetingKey())}</p>
      <FlowHero />

      <section className="mb-10">
        <SectionHeader title={t('home.top')}>
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: t('period.week') },
              { value: 'month', label: t('period.month') },
              { value: 'total', label: t('period.total') },
            ]}
          />
          <PlayAllButton onClick={() => top.data && playTracks(top.data)} disabled={!top.data?.length} />
        </SectionHeader>
        {top.error ? <ErrorState error={top.error} onRetry={top.reload} /> : top.loading && !top.data ? <TrackListSkeleton /> : <TrackList tracks={(top.data ?? []).slice(0, 10)} />}
      </section>

      {!top.error && (
        <>
          {fresh.data?.length ? (
            <section className="mb-10">
              <SectionHeader title={L('Новинки', 'New releases')}>
                <PlayAllButton onClick={() => playTracks(fresh.data!)} />
              </SectionHeader>
              <div className="grid grid-cols-2 gap-x-6 max-[1100px]:grid-cols-1">
                <TrackList tracks={fresh.data.slice(0, 6)} showAlbum={false} />
                <div className="max-[1100px]:hidden"><TrackList tracks={fresh.data.slice(6, 12)} showAlbum={false} startIndex={6} /></div>
              </div>
            </section>
          ) : fresh.loading ? <TrackListSkeleton rows={4} /> : null}

          {albums.data?.length ? (
            <Shelf title={L('Популярные альбомы', 'Popular albums')}>
              {albums.data.map((a) => <AlbumCard key={a.id} album={a} onPlay={() => playAlbum(a.id)} />)}
            </Shelf>
          ) : albums.loading ? <ShelfSkeleton title={L('Популярные альбомы', 'Popular albums')} /> : null}

          {artists.data?.length ? (
            <Shelf title={L('Популярные исполнители', 'Popular artists')}>
              {artists.data.map((a) => <ArtistCard key={a.id} artist={a} subtitle={L('Исполнитель', 'Artist')} />)}
            </Shelf>
          ) : artists.loading ? <ShelfSkeleton title={L('Популярные исполнители', 'Popular artists')} round /> : null}
        </>
      )}
    </Page>
  )
}
