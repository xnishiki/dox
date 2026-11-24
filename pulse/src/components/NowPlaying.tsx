import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ListMusic } from 'lucide-react'
import { useCoverColors } from '../hooks/useCoverColors'
import { useT } from '../i18n'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { Cover } from './Cover'
import { LikeButton, SeekBar, TransportControls } from './PlayerBar'

/** Полноэкранный режим: большая обложка, фон из её цветов */
export function NowPlaying() {
  const t = useT()
  const open = useUi((s) => s.nowPlayingOpen)
  const setNowPlaying = useUi((s) => s.setNowPlaying)
  const toggleQueue = useUi((s) => s.toggleQueue)
  const track = usePlayer((s) => s.queue[s.index])
  const playing = usePlayer((s) => s.playing)
  const colors = useCoverColors(track?.cover)

  return (
    <AnimatePresence>
      {open && track && (
        <motion.section
          key="now-playing"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          className="absolute inset-0 z-40 flex flex-col overflow-hidden text-white"
          aria-label={t('player.nowPlaying')}
        >
          {/* Фон: два цвета обложки, мягко перетекающие при смене трека */}
          <motion.div
            className="absolute inset-0"
            animate={{ background: `radial-gradient(120% 90% at 20% 10%, ${colors.primary} 0%, transparent 60%), radial-gradient(110% 90% at 90% 100%, ${colors.secondary} 0%, transparent 65%), #0f0f12` }}
            transition={{ duration: 1.2 }}
          />
          <div className="absolute inset-0 bg-black/35" />
          <img src={track.cover} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full scale-125 object-cover opacity-25 blur-3xl" />

          <header className="relative flex h-14 items-center justify-between px-5">
            <button className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" onClick={() => setNowPlaying(false)} aria-label={t('player.collapse')}>
              <ChevronDown size={22} />
            </button>
            <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/70">{t('player.nowPlaying')}</span>
            <button className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" onClick={() => { setNowPlaying(false); toggleQueue() }} aria-label={t('player.queue')}>
              <ListMusic size={19} />
            </button>
          </header>

          <div className="relative flex flex-1 items-center justify-center gap-14 px-10 pb-10 max-[1100px]:flex-col max-[1100px]:gap-8">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: playing ? 1 : 0.92, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              className="aspect-square w-[min(46vh,440px)] shrink-0 overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,.55)]"
            >
              <Cover src={track.cover} className="size-full" rounded="rounded-2xl" />
            </motion.div>

            <div className="flex w-full max-w-[460px] flex-col gap-6">
              <AnimatePresence mode="wait">
                <motion.div key={track.qid} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="line-clamp-2 text-[34px] font-extrabold leading-tight tracking-tight">{track.title}</h1>
                      <p className="mt-1 truncate text-[17px] text-white/75">{track.artist}</p>
                      {track.album && <p className="truncate text-[13px] text-white/50">{track.album}</p>}
                    </div>
                    <div className="[&_button]:text-white/80 [&_button[aria-pressed=true]]:!text-ember">
                      <LikeButton size={24} />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="[--hover:rgb(255_255_255/0.2)] [--muted:rgb(255_255_255/0.75)]">
                <SeekBar />
                <TransportControls playSize={64} className="mt-4 justify-center gap-5 [--fg:#fff] [--bg:#0f0f12]" />
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
