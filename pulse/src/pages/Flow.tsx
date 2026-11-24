import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Loader2, Pause, Play, RotateCcw, SkipForward, ThumbsDown } from 'lucide-react'
import { useMemo } from 'react'
import { Cover } from '../components/Cover'
import { Visualizer } from '../components/Visualizer'
import { Page, Segmented } from '../components/ui'
import { computeTaste } from '../flow/recommend'
import { dislikeCurrent, startFlow, useFlow } from '../flow/flow'
import { useTr } from '../i18n'
import { CATEGORIES, GENRES } from '../lib/categories'
import { cn } from '../lib/format'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useTaste, type FlowCharacter, type FlowMood } from '../store/taste'

export default function Flow() {
  const L = useTr()
  const flow = usePlayer((s) => s.flow)
  const playing = usePlayer((s) => s.playing)
  const track = usePlayer((s) => (s.flow ? s.queue[s.index] : undefined))
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const loading = useFlow((s) => s.loading)
  const prefs = useTaste((s) => s.prefs)
  const events = useTaste((s) => s.events)
  const setPrefs = useTaste((s) => s.setPrefs)
  const liked = useLibrary((s) => !!track && s.liked.some((t) => t.id === track.id))
  const toggleLike = useLibrary((s) => s.toggleLike)
  const active = flow && playing

  const topGenres = useMemo(() => {
    const taste = computeTaste(events, { ...prefs, genres: [] })
    const names = new Map(CATEGORIES.map((c) => [c.query.tags ?? '', c]))
    return [...taste.genres.entries()].filter(([g, w]) => w > 0.5 && names.has(g)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, w]) => ({ c: names.get(g)!, w }))
  }, [events, prefs])

  const changePrefs = (patch: Parameters<typeof setPrefs>[0]) => {
    setPrefs(patch)
    // Волна уже играет — пересобираем её под новые настройки
    if (flow) void startFlow()
  }

  const toggleGenre = (tag: string) => changePrefs({ genres: prefs.genres.includes(tag) ? prefs.genres.filter((g) => g !== tag) : [...prefs.genres, tag].slice(-5) })
  const genreTag = (c: (typeof GENRES)[number]) => c.query.tags ?? c.query.fuzzytags!.split('+')[0]
  const maxW = topGenres[0]?.w ?? 1

  return (
    <Page>
      <div className="relative mb-10 flex items-center gap-10 overflow-hidden rounded-[28px] bg-surface p-8 shadow-soft max-[1100px]:flex-col max-[1100px]:gap-4">
        <div className="bg-brand absolute -left-24 -top-24 size-96 rounded-full opacity-15 blur-3xl" />
        <div className="absolute -bottom-32 right-10 size-80 rounded-full bg-mint opacity-10 blur-3xl" />

        <div className="relative grid size-[340px] shrink-0 place-items-center">
          <Visualizer size={340} bars={96} inner={0.33} className="absolute inset-0" />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            animate={active ? { boxShadow: ['0 0 0 0 rgba(255,138,61,.5)', '0 0 0 26px rgba(255,138,61,0)'] } : { boxShadow: '0 16px 50px rgba(255,106,61,.45)' }}
            transition={active ? { duration: 1.6, repeat: Infinity } : undefined}
            onClick={() => (flow ? toggle() : void startFlow())}
            className="bg-brand relative grid size-[150px] place-items-center rounded-full text-[#1b1208]"
            aria-label={active ? L('Пауза', 'Pause') : L('Запустить Поток', 'Start Flow')}
          >
            {loading && !flow ? <Loader2 size={52} className="animate-spin" /> : active ? <Pause size={52} className="fill-current" /> : <Play size={52} className="translate-x-1 fill-current" />}
          </motion.button>
        </div>

        <div className="relative min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-sun">{L('Персональная волна', 'Personal wave')}</p>
          <h1 className="text-[48px] font-extrabold leading-tight tracking-tight">{L('Поток', 'Flow')}</h1>
          <AnimatePresence mode="wait">
            {track ? (
              <motion.div key={track.qid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 flex items-center gap-4">
                <Cover src={track.cover} className="size-16 shadow-soft" rounded="rounded-xl" />
                <div className="min-w-0">
                  <div className="truncate text-[18px] font-bold">{track.title}</div>
                  <div className="truncate text-[14px] text-muted">{track.artist}</div>
                </div>
              </motion.div>
            ) : (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 max-w-md text-[15px] text-muted">
                {L('Нажми на кнопку — Pulse подберёт музыку по твоим лайкам, прослушиваниям и любимым жанрам. Чем больше слушаешь, тем точнее.', 'Press play — Pulse picks music from your likes, listens and favourite genres. The more you listen, the better it gets.')}
              </motion.p>
            )}
          </AnimatePresence>
          {track && (
            <div className="mt-5 flex items-center gap-3">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleLike(track)} className={cn('flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold transition-colors', liked ? 'bg-ember/20 text-ember' : 'bg-elev hover:bg-hover')} aria-pressed={liked}>
                <Heart size={18} className={liked ? 'fill-current' : ''} /> {L('Нравится', 'Like')}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={dislikeCurrent} className="flex h-11 items-center gap-2 rounded-full bg-elev px-5 text-[13.5px] font-bold hover:bg-hover">
                <ThumbsDown size={18} /> {L('Не нравится', 'Dislike')}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => next()} className="grid size-11 place-items-center rounded-full bg-elev hover:bg-hover" aria-label={L('Дальше', 'Next')}>
                <SkipForward size={18} className="fill-current" />
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-8 max-[1100px]:grid-cols-1">
        <div>
          <h2 className="mb-3 text-[18px] font-extrabold">{L('Настроение', 'Mood')}</h2>
          <Segmented<FlowMood>
            value={prefs.mood}
            onChange={(mood) => changePrefs({ mood })}
            options={[
              { value: 'any', label: L('Любое', 'Any') },
              { value: 'upbeat', label: L('Бодрое', 'Upbeat') },
              { value: 'calm', label: L('Спокойное', 'Calm') },
              { value: 'sad', label: L('Грустное', 'Sad') },
            ]}
          />
        </div>
        <div>
          <h2 className="mb-3 text-[18px] font-extrabold">{L('Характер', 'Character')}</h2>
          <Segmented<FlowCharacter>
            value={prefs.character}
            onChange={(character) => changePrefs({ character })}
            options={[
              { value: 'favorite', label: L('Любимое', 'Favourites') },
              { value: 'new', label: L('Новое', 'New') },
              { value: 'popular', label: L('Популярное', 'Popular') },
            ]}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-[18px] font-extrabold">{L('Жанры', 'Genres')}</h2>
        <p className="mb-3 text-[13px] text-muted">{L('Выбери до 5 жанров — они получат приоритет. Можно ничего не выбирать.', 'Pick up to 5 genres to prioritise — or none at all.')}</p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((c) => {
            const tag = genreTag(c)
            const on = prefs.genres.includes(tag)
            return (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => toggleGenre(tag)}
                className={cn('rounded-full border px-4 py-2 text-[13px] font-bold transition-colors', on ? 'border-transparent text-white' : 'border-line text-muted hover:text-fg')}
                style={on ? { background: `linear-gradient(135deg, ${c.colors[0]}, ${c.colors[1]})` } : undefined}
                aria-pressed={on}
              >
                {L(c.ru, c.en)}
              </motion.button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold">{L('Твой вкус', 'Your taste')}</h2>
          {flow && (
            <button onClick={() => void startFlow()} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted hover:text-fg">
              <RotateCcw size={14} /> {L('Пересобрать волну', 'Rebuild wave')}
            </button>
          )}
        </div>
        {topGenres.length ? (
          <div className="flex max-w-xl flex-col gap-2">
            {topGenres.map(({ c, w }) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[13px] font-semibold">{L(c.ru, c.en)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-elev">
                  <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(w / maxW) * 100}%` }} transition={{ duration: 0.6 }} style={{ background: `linear-gradient(90deg, ${c.colors[0]}, ${c.colors[1]})` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">{L('Пока мало данных. Слушай, лайкай и пропускай — здесь появятся твои любимые жанры.', 'Not much data yet. Listen, like and skip — your favourite genres will show up here.')}</p>
        )}
        <p className="mt-4 text-[12px] text-faint">{L(`Учтено событий: ${events.length}. История хранится на компьютере и синхронизируется с аккаунтом.`, `Events tracked: ${events.length}. History is stored locally and synced to your account.`)}</p>
      </section>
    </Page>
  )
}
