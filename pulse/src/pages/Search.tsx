import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Disc3, Hash, ListMusic, Mic2, Music2, Search as SearchIcon, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlbumCard, ArtistCard, CardGrid, MediaCard, ShelfSkeleton } from '../components/Cards'
import { CategoryGrid } from './Categories'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackList, TrackListSkeleton } from '../components/TrackList'
import { ErrorState, Page, Segmented } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useTr } from '../i18n'
import { playAlbum } from '../lib/actions'
import { cn } from '../lib/format'
import { jamendo, type Suggestion } from '../lib/jamendo'
import { searchPublicPlaylists } from '../sync/playlists-remote'

const HISTORY_KEY = 'pulse.searchHistory'
const readHistory = (): string[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] } }
const saveHistory = (q: string) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...readHistory().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8))) } catch { /* ignore */ }
}

type Tab = 'all' | 'tracks' | 'albums' | 'artists' | 'playlists'

const suggestionIcon = { track: Music2, album: Disc3, artist: Mic2, tag: Hash }

export default function Search() {
  const L = useTr()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [input, setInput] = useState(query)
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)
  const [tab, setTab] = useState<Tab>('all')
  const [history, setHistory] = useState(readHistory)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setInput(query) }, [query])
  useEffect(() => { inputRef.current?.focus() }, [])

  // Подсказки с задержкой, чтобы не дёргать API на каждую букву
  useEffect(() => {
    const q = input.trim()
    if (q.length < 2 || q === query) { setSuggestions([]); return }
    const ctrl = new AbortController()
    const id = setTimeout(() => {
      jamendo.suggest(q, ctrl.signal).then(setSuggestions).catch(() => setSuggestions([]))
    }, 220)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [input, query])

  const run = (q: string) => {
    const text = q.trim()
    if (!text) return
    saveHistory(text)
    setHistory(readHistory())
    setSuggestions([])
    setActive(-1)
    setTab('all')
    setParams({ q: text })
    inputRef.current?.blur()
  }

  const results = useAsync((signal) => (query ? jamendo.search(query, signal) : Promise.resolve(null)), [query])
  const playlists = useAsync((signal) => (query ? searchPublicPlaylists(query, signal) : Promise.resolve([])), [query])

  const dropdown = focused && (suggestions.length > 0 || (!input && history.length > 0))
  const items = useMemo(() => (input ? suggestions.map((s) => s.text) : history), [input, suggestions, history])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)) }
    else if (e.key === 'Enter') run(active >= 0 ? items[active] : input)
    else if (e.key === 'Escape') { setSuggestions([]); inputRef.current?.blur() }
  }

  const r = results.data
  const empty = r && !r.tracks.length && !r.albums.length && !r.artists.length && !playlists.data?.length

  return (
    <Page>
      <div className="relative z-20 mb-7 max-w-[640px]">
        <div className={cn('flex h-13 items-center gap-3 rounded-2xl border bg-surface px-4 transition-colors', focused ? 'border-sun/60' : 'border-line')}>
          <SearchIcon size={20} className="text-muted" />
          <input
            id="search-input"
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setActive(-1) }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={onKeyDown}
            placeholder={L('Треки, альбомы, исполнители, плейлисты', 'Tracks, albums, artists, playlists')}
            className="h-12 flex-1 bg-transparent text-[15.5px] font-medium outline-none placeholder:text-faint"
            autoComplete="off"
            spellCheck={false}
          />
          {input && (
            <button onClick={() => { setInput(''); setParams({}); inputRef.current?.focus() }} className="grid size-7 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" aria-label={L('Очистить', 'Clear')}>
              <X size={16} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {dropdown && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="absolute inset-x-0 top-[calc(100%+6px)] overflow-hidden rounded-2xl border border-line bg-elev p-1.5 shadow-soft"
              role="listbox"
            >
              {!input && <li className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{L('Недавние запросы', 'Recent searches')}</li>}
              {items.map((text, i) => {
                const Icon = input ? suggestionIcon[suggestions[i].type] : Clock
                return (
                  <li key={`${text}-${i}`} role="option" aria-selected={i === active}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => run(text)}
                      onMouseEnter={() => setActive(i)}
                      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px]', i === active ? 'bg-hover' : 'hover:bg-hover')}
                    >
                      <Icon size={16} className="shrink-0 text-muted" />
                      <span className="truncate">{text}</span>
                    </button>
                  </li>
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {!query ? (
        <>
          <h2 className="mb-4 text-[22px] font-extrabold tracking-tight">{L('Обзор категорий', 'Browse categories')}</h2>
          <CategoryGrid />
        </>
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={results.reload} />
      ) : results.loading && !r ? (
        <>
          <TrackListSkeleton rows={5} />
          <div className="mt-8"><ShelfSkeleton title={L('Альбомы', 'Albums')} /></div>
        </>
      ) : empty ? (
        <p className="py-16 text-center text-muted">{L(`По запросу «${query}» ничего не нашлось`, `Nothing found for “${query}”`)}</p>
      ) : r ? (
        <>
          <div className="mb-6">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: L('Всё', 'All') },
                { value: 'tracks', label: `${L('Треки', 'Tracks')} · ${r.tracks.length}` },
                { value: 'albums', label: `${L('Альбомы', 'Albums')} · ${r.albums.length}` },
                { value: 'artists', label: `${L('Исполнители', 'Artists')} · ${r.artists.length}` },
                { value: 'playlists', label: `${L('Плейлисты', 'Playlists')} · ${playlists.data?.length ?? 0}` },
              ]}
            />
          </div>

          {(tab === 'all' || tab === 'tracks') && r.tracks.length > 0 && (
            <section className="mb-9">
              {tab === 'all' && <h2 className="mb-2 text-[20px] font-extrabold">{L('Треки', 'Tracks')}</h2>}
              <TrackList tracks={tab === 'all' ? r.tracks.slice(0, 5) : r.tracks} />
            </section>
          )}
          {(tab === 'all' || tab === 'artists') && r.artists.length > 0 && (
            <section className="mb-9">
              {tab === 'all' && <h2 className="mb-2 text-[20px] font-extrabold">{L('Исполнители', 'Artists')}</h2>}
              <CardGrid>{(tab === 'all' ? r.artists.slice(0, 6) : r.artists).map((a) => <ArtistCard key={a.id} artist={a} subtitle={L('Исполнитель', 'Artist')} />)}</CardGrid>
            </section>
          )}
          {(tab === 'all' || tab === 'albums') && r.albums.length > 0 && (
            <section className="mb-9">
              {tab === 'all' && <h2 className="mb-2 text-[20px] font-extrabold">{L('Альбомы', 'Albums')}</h2>}
              <CardGrid>{(tab === 'all' ? r.albums.slice(0, 6) : r.albums).map((a) => <AlbumCard key={a.id} album={a} onPlay={() => playAlbum(a.id)} />)}</CardGrid>
            </section>
          )}
          {(tab === 'all' || tab === 'playlists') && !!playlists.data?.length && (
            <section className="mb-9">
              {tab === 'all' && <h2 className="mb-2 text-[20px] font-extrabold">{L('Публичные плейлисты', 'Public playlists')}</h2>}
              <CardGrid>
                {(tab === 'all' ? playlists.data.slice(0, 6) : playlists.data).map((p) => (
                  <MediaCard key={p.id} to={`/playlist/${p.id}`} title={p.name} subtitle={`${p.ownerName ?? ''} · ${p.tracks.length} ${L('тр.', 'tr.')}`} coverNode={<PlaylistCover playlist={p} />} />
                ))}
              </CardGrid>
            </section>
          )}
          {tab === 'playlists' && !playlists.data?.length && (
            <p className="flex items-center justify-center gap-2 py-12 text-muted"><ListMusic size={18} /> {L('Публичных плейлистов не найдено', 'No public playlists found')}</p>
          )}
        </>
      ) : null}
    </Page>
  )
}
