import { AnimatePresence, motion } from 'framer-motion'
import {
  Heart, ListMusic, Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
  SlidersHorizontal, ThumbsDown, Volume, Volume1, Volume2, VolumeX,
} from 'lucide-react'
import { dislikeCurrent } from '../flow/flow'
import { useEq } from '../store/eq'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { usePlaybackTime } from '../hooks/usePlaybackTime'
import { useT, useTr } from '../i18n'
import { cn, formatTime } from '../lib/format'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { Cover } from './Cover'

export function SeekBar({ className }: { className?: string }) {
  const { time, duration } = usePlaybackTime()
  const seek = usePlayer((s) => s.seek)
  const fallbackDuration = usePlayer((s) => s.duration)
  const total = duration || fallbackDuration
  const [drag, setDrag] = useState<number | null>(null)
  const value = drag ?? time
  const pct = total ? (value / total) * 100 : 0
  return (
    <div className={cn('flex w-full items-center gap-2.5', className)}>
      <span className="w-10 text-right text-[11px] tabular-nums text-muted">{formatTime(value)}</span>
      <input
        type="range"
        className="range flex-1"
        min={0}
        max={total || 1}
        step={0.1}
        value={value}
        disabled={!total}
        style={{ '--p': `${pct}%` } as CSSProperties}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => { if (drag != null) { seek(drag); setDrag(null) } }}
        onKeyUp={() => { if (drag != null) { seek(drag); setDrag(null) } }}
        aria-label="Перемотка"
      />
      <span className="w-10 text-[11px] tabular-nums text-muted">{formatTime(total)}</span>
    </div>
  )
}

export function PlayButton({ size = 40, className }: { size?: number; className?: string }) {
  const t = useT()
  const playing = usePlayer((s) => s.playing)
  const buffering = usePlayer((s) => s.buffering)
  const toggle = usePlayer((s) => s.toggle)
  const Icon = buffering && playing ? Loader2 : playing ? Pause : Play
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={toggle}
      className={cn('grid shrink-0 place-items-center rounded-full bg-fg text-bg shadow-soft', className)}
      style={{ width: size, height: size }}
      aria-label={t(playing ? 'player.pause' : 'player.play')}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={buffering && playing ? 'load' : playing ? 'pause' : 'play'}initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.12 }}>
          <Icon size={size * 0.42} className={cn(Icon === Loader2 ? 'animate-spin' : 'fill-current', Icon === Play && 'translate-x-[1px]')} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

export function TransportControls({ playSize = 40, className }: { playSize?: number; className?: string }) {
  const t = useT()
  const { next, prev, shuffle, repeat, toggleShuffle, cycleRepeat } = usePlayer()
  const ctl = 'grid size-9 place-items-center rounded-full text-muted transition hover:text-fg active:scale-90'
  // Активный переключатель: зелёный и с точкой снизу, как индикатор режима
  const toggleCls = (on: boolean) =>
    cn('relative grid size-9 place-items-center rounded-full transition active:scale-90', on ? 'text-mint' : 'text-muted hover:text-fg')
  const dot = <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-mint" />
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button className={toggleCls(shuffle)} onClick={toggleShuffle} aria-label={t('player.shuffle')} aria-pressed={shuffle} title={t('player.shuffle')}>
        <Shuffle size={17} />
        {shuffle && dot}
      </button>
      <button className={ctl} onClick={prev} aria-label={t('player.prev')} title={t('player.prev')}>
        <SkipBack size={20} className="fill-current" />
      </button>
      <PlayButton size={playSize} />
      <button className={ctl} onClick={() => next()} aria-label={t('player.next')} title={t('player.next')}>
        <SkipForward size={20} className="fill-current" />
      </button>
      <button
        className={toggleCls(repeat !== 'off')}
        onClick={cycleRepeat}
        aria-label={t(repeat === 'off' ? 'player.repeatOff' : repeat === 'all' ? 'player.repeatAll' : 'player.repeatOne')}
        title={t(repeat === 'off' ? 'player.repeatOff' : repeat === 'all' ? 'player.repeatAll' : 'player.repeatOne')}
      >
        <RepeatIcon size={17} />
        {repeat !== 'off' && dot}
      </button>
    </div>
  )
}

export function LikeButton({ size = 18 }: { size?: number }) {
  const t = useT()
  const track = usePlayer((s) => s.queue[s.index])
  const liked = useLibrary((s) => !!track && s.liked.some((x) => x.id === track.id))
  const toggleLike = useLibrary((s) => s.toggleLike)
  const [burst, setBurst] = useState(0)
  if (!track) return null
  return (
    <motion.button
      key={burst}
      animate={burst ? { scale: [1, 1.35, 0.9, 1] } : undefined}
      transition={{ duration: 0.45 }}
      className={cn('grid size-9 place-items-center rounded-full transition', liked ? 'text-ember' : 'text-muted hover:text-fg')}
      onClick={() => {
        toggleLike(track)
        if (!liked) setBurst((b) => b + 1)
      }}
      aria-label={t(liked ? 'player.unlike' : 'player.like')}
      aria-pressed={liked}
    >
      <Heart size={size} className={cn(liked && 'fill-current')} />
    </motion.button>
  )
}

function VolumeControl() {
  const t = useT()
  const volume = usePlayer((s) => s.volume)
  const muted = usePlayer((s) => s.muted)
  const setVolume = usePlayer((s) => s.setVolume)
  const toggleMute = usePlayer((s) => s.toggleMute)
  const v = muted ? 0 : volume
  const Icon = v === 0 ? VolumeX : v < 0.35 ? Volume : v < 0.7 ? Volume1 : Volume2
  return (
    <div className="flex items-center gap-1.5">
      <button className="grid size-9 place-items-center rounded-full text-muted hover:text-fg" onClick={toggleMute} aria-label={t('player.mute')}>
        <Icon size={18} />
      </button>
      <input
        type="range"
        className="range w-24 max-[1000px]:w-20"
        min={0}
        max={1}
        step={0.01}
        value={v}
        onChange={(e) => setVolume(Number(e.target.value))}
        onWheel={(e) => setVolume(volume + (e.deltaY < 0 ? 0.05 : -0.05))}
        style={{ '--p': `${v * 100}%` } as CSSProperties}
        aria-label="Громкость"
      />
    </div>
  )
}

export function PlayerBar() {
  const t = useT()
  const L = useTr()
  const flow = usePlayer((s) => s.flow)
  const eqOpen = useUi((s) => s.eqOpen)
  const setEqOpen = useUi((s) => s.setEqOpen)
  const eqEnabled = useEq((s) => s.enabled)
  const eqPreset = useEq((s) => s.presetId)
  const track = usePlayer((s) => s.queue[s.index])
  const queueOpen = useUi((s) => s.queueOpen)
  const toggleQueue = useUi((s) => s.toggleQueue)
  const setNowPlaying = useUi((s) => s.setNowPlaying)
  const showToast = useUi((s) => s.showToast)
  const error = usePlayer((s) => s.error)

  useEffect(() => { if (error) showToast(error) }, [error, showToast])

  return (
    <footer className="glass relative z-30 grid h-[88px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-4 border-t border-line px-4">
      <div className="flex min-w-0 items-center gap-3">
        {track ? (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setNowPlaying(true)}
              className="group relative shrink-0 overflow-hidden rounded-lg shadow-soft"
              aria-label={t('player.nowPlaying')}
              title={t('player.nowPlaying')}
            >
              <Cover src={track.cover} className="size-14" />
            </motion.button>
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={track.qid} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                  <button onClick={() => setNowPlaying(true)} className="block max-w-full truncate text-left text-[14px] font-semibold hover:underline">
                    {track.title}
                  </button>
                  <div className="flex items-center gap-1.5 truncate text-[12.5px] text-muted">
                    {flow && <span className="bg-brand rounded px-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#1b1208]">{L('Поток', 'Flow')}</span>}
                    <span className="truncate">{track.artist}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <LikeButton />
          </>
        ) : (
          <div className="text-[13px] text-muted">
            <div className="font-semibold text-fg">{t('player.nothing')}</div>
            {t('player.pick')}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <TransportControls />
        <SeekBar className="max-w-[560px]" />
      </div>

      <div className="flex items-center justify-end gap-1">
        {flow && (
          <button className="grid size-9 place-items-center rounded-full text-muted hover:text-fg" onClick={dislikeCurrent} aria-label={L('Не нравится', 'Dislike')} title={L('Не нравится — в «Потоке» такое больше не будет', 'Dislike — Flow will play less like this')}>
            <ThumbsDown size={17} />
          </button>
        )}
        <button
          className={cn('grid size-9 place-items-center rounded-full transition hover:text-fg', eqOpen ? 'text-sun' : eqEnabled && eqPreset !== 'flat' ? 'text-mint' : 'text-muted')}
          onClick={() => setEqOpen(!eqOpen)}
          aria-label={t('player.eq')}
          aria-pressed={eqOpen}
          title={t('player.eq')}
        >
          <SlidersHorizontal size={18} />
        </button>
        <button
          className={cn('grid size-9 place-items-center rounded-full transition hover:text-fg', queueOpen ? 'text-sun' : 'text-muted')}
          onClick={toggleQueue}
          aria-label={t('player.queue')}
          aria-pressed={queueOpen}
          title={t('player.queue')}
        >
          <ListMusic size={18} />
        </button>
        <VolumeControl />
      </div>
    </footer>
  )
}
