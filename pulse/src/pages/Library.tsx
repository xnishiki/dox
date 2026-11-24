import { FolderOpen, Heart, KeyRound, Plus, RefreshCw, Search, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CardGrid, MediaCard } from '../components/Cards'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackList } from '../components/TrackList'
import { Page, PlayAllButton, Segmented } from '../components/ui'
import { inputCls } from '../components/Modal'
import { useAsync } from '../hooks/useAsync'
import { useT, useTr } from '../i18n'
import { isElectron } from '../lib/platform'
import { useAuth } from '../store/auth'
import { useLibrary } from '../store/library'
import { useLocal } from '../store/local'
import { usePlayer } from '../store/player'
import { importPlaylistFile, usePlaylists, type Playlist } from '../store/playlists'
import { useUi } from '../store/ui'
import { searchPublicPlaylists } from '../sync/playlists-remote'

type Tab = 'liked' | 'playlists' | 'public' | 'local'

function PlaylistGrid({ list, empty }: { list: Playlist[]; empty: string }) {
  const L = useTr()
  if (!list.length) return <p className="py-12 text-center text-muted">{empty}</p>
  return (
    <CardGrid>
      {list.map((p) => (
        <MediaCard
          key={p.id}
          to={`/playlist/${p.id}`}
          title={p.name}
          subtitle={`${p.role === 'owner' ? L('Мой', 'Mine') : p.ownerName ?? ''}${p.collaborative ? ' · ' + L('совместный', 'collab') : ''} · ${p.tracks.length} ${L('тр.', 'tr.')}`}
          coverNode={<PlaylistCover playlist={p} />}
          onPlay={p.tracks.length ? () => usePlayer.getState().playTracks(p.tracks) : undefined}
        />
      ))}
    </CardGrid>
  )
}

function LikedTab() {
  const t = useT()
  const liked = useLibrary((s) => s.liked)
  const playTracks = usePlayer((s) => s.playTracks)
  return (
    <>
      <div className="mb-6 flex items-center gap-5">
        <div className="bg-brand grid size-24 shrink-0 place-items-center rounded-2xl shadow-[0_16px_40px_rgba(255,106,61,.3)]">
          <Heart size={40} className="fill-[#1b1208] text-[#1b1208]" />
        </div>
        <div>
          <h2 className="text-[26px] font-extrabold tracking-tight">{t('library.liked')}</h2>
          <p className="mb-2 text-[13.5px] text-muted">{liked.length} {t('common.tracks')}</p>
          <PlayAllButton onClick={() => playTracks(liked)} disabled={!liked.length} />
        </div>
      </div>
      {liked.length ? <TrackList tracks={liked} /> : <p className="py-10 text-center text-muted">{t('library.empty')}</p>}
    </>
  )
}

function PlaylistsTab() {
  const L = useTr()
  const all = usePlaylists((s) => s.playlists)
  const playlists = all.filter((p) => !p.deleted)
  const user = useAuth((s) => s.user)
  const openDialog = useUi((s) => s.openDialog)
  const showToast = useUi((s) => s.showToast)
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const mine = playlists.filter((p) => p.role !== 'follower')
  const followed = playlists.filter((p) => p.role === 'follower')

  const onImport = async (file?: File) => {
    if (!file) return
    try {
      const p = await importPlaylistFile(file, user?.id ?? null)
      showToast(L(`Импортировано: ${p.name}`, `Imported: ${p.name}`))
      navigate(`/playlist/${p.id}`)
    } catch (err) { showToast((err as Error).message) }
  }

  const btn = 'inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[13px] font-bold hover:bg-surface'
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        <button className={btn} onClick={() => openDialog({ type: 'playlist' })}><Plus size={16} /> {L('Новый плейлист', 'New playlist')}</button>
        <button className={btn} onClick={() => openDialog({ type: 'join' })}><KeyRound size={15} /> {L('Ввести код', 'Enter code')}</button>
        <button className={btn} onClick={() => fileRef.current?.click()}><Upload size={15} /> {L('Импорт .json', 'Import .json')}</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <h3 className="mb-1 text-[13px] font-bold uppercase tracking-[0.14em] text-faint">{L('Мои и совместные', 'Mine & collaborative')}</h3>
      <PlaylistGrid list={mine} empty={L('Создай первый плейлист', 'Create your first playlist')} />
      <h3 className="mb-1 mt-8 text-[13px] font-bold uppercase tracking-[0.14em] text-faint">{L('Подписки', 'Following')}</h3>
      <PlaylistGrid list={followed} empty={L('Подпишись на чужой плейлист — он появится здесь', 'Follow someone’s playlist to see it here')} />
    </>
  )
}

function PublicTab() {
  const L = useTr()
  const user = useAuth((s) => s.user)
  const openDialog = useUi((s) => s.openDialog)
  const [q, setQ] = useState('')
  const res = useAsync((signal) => searchPublicPlaylists(q, signal, 48), [q, user?.id])
  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-muted">{L('Публичные плейлисты других слушателей доступны после входа в аккаунт.', 'Sign in to browse public playlists.')}</p>
        <button className="bg-brand h-10 rounded-full px-5 text-[13.5px] font-bold text-[#1b1208]" onClick={() => openDialog({ type: 'auth' })}>{L('Войти', 'Sign in')}</button>
      </div>
    )
  }
  return (
    <>
      <div className="relative mb-5 max-w-md">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input className={`${inputCls} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Поиск по названию', 'Search by name')} />
      </div>
      {res.loading && !res.data ? <p className="py-10 text-center text-muted">…</p> : <PlaylistGrid list={res.data ?? []} empty={L('Ничего не найдено', 'Nothing found')} />}
    </>
  )
}

function LocalTab() {
  const L = useTr()
  const { folder, tracks, scanning, progress, error, pickFolder, rescan } = useLocal()
  const playTracks = usePlayer((s) => s.playTracks)
  if (!isElectron) return <p className="py-12 text-center text-muted">{L('Локальные файлы доступны в приложении для Windows.', 'Local files are available in the desktop app.')}</p>
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[13px] font-bold hover:bg-surface" onClick={pickFolder} disabled={scanning}>
          <FolderOpen size={16} /> {folder ? L('Другая папка', 'Change folder') : L('Выбрать папку с музыкой', 'Choose music folder')}
        </button>
        {folder && (
          <button className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[13px] font-bold hover:bg-surface disabled:opacity-50" onClick={rescan} disabled={scanning}>
            <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} /> {L('Обновить', 'Rescan')}
          </button>
        )}
        {folder && <span className="truncate text-[12.5px] text-muted">{folder}</span>}
        {tracks.length > 0 && <span className="ml-auto"><PlayAllButton onClick={() => playTracks(tracks)} /></span>}
      </div>
      {scanning && <p className="mb-3 text-[13px] text-muted">{L('Сканирую…', 'Scanning…')} {progress && `${progress.done} / ${progress.total}`}</p>}
      {error && <p className="mb-3 text-[13px] text-[#ff6369]">{error}</p>}
      {tracks.length ? <TrackList tracks={tracks} animateFirst={16} /> : !scanning && (
        <p className="py-10 text-center text-muted">{folder ? L('В папке нет mp3, flac, wav или ogg', 'No mp3, flac, wav or ogg files found') : L('Выбери папку — Pulse найдёт mp3, flac, wav и ogg, включая вложенные папки.', 'Pick a folder — Pulse finds mp3, flac, wav and ogg files.')}</p>
      )}
    </>
  )
}

export default function Library() {
  const L = useTr()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'liked'
  return (
    <Page>
      <h1 className="mb-5 text-[32px] font-extrabold tracking-tight">{L('Моя медиатека', 'My Library')}</h1>
      <div className="mb-6">
        <Segmented
          value={tab}
          onChange={(v) => setParams({ tab: v })}
          options={[
            { value: 'liked', label: L('Любимые', 'Liked') },
            { value: 'playlists', label: L('Плейлисты', 'Playlists') },
            { value: 'public', label: L('Публичные', 'Public') },
            { value: 'local', label: L('Локальные файлы', 'Local files') },
          ]}
        />
      </div>
      {tab === 'liked' && <LikedTab />}
      {tab === 'playlists' && <PlaylistsTab />}
      {tab === 'public' && <PublicTab />}
      {tab === 'local' && <LocalTab />}
    </Page>
  )
}
