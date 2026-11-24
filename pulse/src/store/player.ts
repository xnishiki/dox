import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { engine } from '../audio/engine'
import type { RepeatMode, Track } from '../lib/types'

/** Трек в очереди: у каждой позиции свой qid, чтобы один трек мог стоять в очереди дважды */
export type QueueItem = Track & { qid: string }

let qidCounter = 0
const withQid = (t: Track): QueueItem => ({ ...t, qid: `${Date.now().toString(36)}-${(qidCounter++).toString(36)}` })

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface PlayerState {
  queue: QueueItem[]
  /** Порядок до включения перемешивания — чтобы вернуть его при выключении */
  original: QueueItem[] | null
  index: number
  playing: boolean
  buffering: boolean
  /** Позиция для сохранения между запусками (обновляется раз в пару секунд) */
  position: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
  /** Играет «Поток» — очередь пополняется сама */
  flow: boolean

  current: () => QueueItem | undefined
  playTracks: (tracks: Track[], startIndex?: number, opts?: { flow?: boolean }) => void
  playAt: (index: number) => void
  toggle: () => void
  next: (auto?: boolean) => void
  prev: () => void
  seek: (t: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  addToQueue: (tracks: Track[]) => void
  playNext: (track: Track) => void
  removeFromQueue: (qid: string) => void
  reorderUpcoming: (upcoming: QueueItem[]) => void
  clearUpcoming: () => void
  /** Внутреннее: синхронизация со звуковым движком */
  _sync: (patch: Partial<Pick<PlayerState, 'playing' | 'buffering' | 'position' | 'duration' | 'error'>>) => void
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => {
      const load = (autoplay: boolean, startAt = 0) => {
        const track = get().current()
        if (!track) return
        set({ duration: track.duration || 0, position: startAt, error: null })
        engine.load(track.src, startAt)
        if (autoplay) engine.play().catch(() => set({ playing: false }))
      }

      return {
        queue: [],
        original: null,
        index: -1,
        playing: false,
        buffering: false,
        position: 0,
        duration: 0,
        volume: 0.8,
        muted: false,
        shuffle: false,
        repeat: 'off',
        error: null,
        flow: false,

        current: () => get().queue[get().index],

        playTracks: (tracks, startIndex = 0, opts) => {
          if (!tracks.length) return
          const items = tracks.map(withQid)
          const flow = !!opts?.flow
          set({ flow })
          // В «Потоке» порядок уже подобран — перемешивание не нужно
          if (get().shuffle && !flow) {
            const first = items[startIndex]
            const rest = shuffled(items.filter((_, i) => i !== startIndex))
            set({ queue: [first, ...rest], original: items, index: 0 })
          } else {
            set({ queue: items, original: null, index: Math.min(startIndex, items.length - 1) })
          }
          load(true)
        },

        playAt: (index) => {
          if (index < 0 || index >= get().queue.length) return
          set({ index })
          load(true)
        },

        toggle: () => {
          const track = get().current()
          if (!track) return
          if (!engine.audio.getAttribute('src')) return load(true, get().position)
          if (engine.audio.paused) engine.play().catch(() => {})
          else engine.pause()
        },

        next: (auto = false) => {
          const { queue, index, repeat } = get()
          if (!queue.length) return
          if (auto && repeat === 'one') {
            engine.seek(0)
            engine.play().catch(() => {})
            return
          }
          let i = index + 1
          if (i >= queue.length) {
            if (auto && repeat === 'off') {
              engine.pause()
              engine.seek(0)
              set({ position: 0 })
              return
            }
            i = 0
          }
          set({ index: i })
          load(true)
        },

        prev: () => {
          const { queue, index, repeat } = get()
          if (!queue.length) return
          if (engine.audio.currentTime > 3) return engine.seek(0)
          let i = index - 1
          if (i < 0) i = repeat === 'all' ? queue.length - 1 : 0
          set({ index: i })
          load(true)
        },

        seek: (t) => {
          engine.seek(t)
          set({ position: t })
        },

        setVolume: (v) => {
          const volume = Math.max(0, Math.min(1, v))
          set({ volume, muted: volume === 0 ? get().muted : false })
          engine.setVolume(volume, get().muted)
        },

        toggleMute: () => {
          const muted = !get().muted
          set({ muted })
          engine.setVolume(get().volume, muted)
        },

        toggleShuffle: () => {
          const { shuffle, queue, index, original } = get()
          const cur = queue[index]
          if (!shuffle) {
            const rest = shuffled(queue.filter((_, i) => i !== index))
            set({ shuffle: true, original: queue, queue: cur ? [cur, ...rest] : rest, index: cur ? 0 : -1 })
          } else {
            const restored = original ?? queue
            set({ shuffle: false, original: null, queue: restored, index: cur ? restored.findIndex((t) => t.qid === cur.qid) : -1 })
          }
        },

        cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),

        addToQueue: (tracks) => {
          const items = tracks.map(withQid)
          const wasEmpty = get().queue.length === 0
          set((s) => ({ queue: [...s.queue, ...items], original: s.original ? [...s.original, ...items] : null }))
          if (wasEmpty) { set({ index: 0 }); load(true) }
        },

        playNext: (track) => {
          const item = withQid(track)
          if (get().queue.length === 0) return get().playTracks([track])
          set((s) => {
            const queue = [...s.queue]
            queue.splice(s.index + 1, 0, item)
            return { queue, original: s.original ? [...s.original, item] : null }
          })
        },

        removeFromQueue: (qid) => {
          const { queue, index } = get()
          const i = queue.findIndex((t) => t.qid === qid)
          if (i < 0) return
          const nextQueue = queue.filter((t) => t.qid !== qid)
          const original = get().original?.filter((t) => t.qid !== qid) ?? null
          if (i === index) {
            if (!nextQueue.length) { engine.stop(); set({ queue: [], original: null, index: -1, playing: false }); return }
            set({ queue: nextQueue, original, index: Math.min(i, nextQueue.length - 1) })
            load(get().playing)
          } else {
            set({ queue: nextQueue, original, index: i < index ? index - 1 : index })
          }
        },

        reorderUpcoming: (upcoming) => {
          const { queue, index } = get()
          set({ queue: [...queue.slice(0, index + 1), ...upcoming] })
        },

        clearUpcoming: () => {
          const { queue, index } = get()
          set({ queue: queue.slice(0, index + 1), original: null })
        },

        _sync: (patch) => set(patch),
      }
    },
    {
      name: 'pulse.player',
      version: 1,
      partialize: (s) => ({
        queue: s.queue,
        original: s.original,
        index: s.index,
        position: s.position,
        volume: s.volume,
        muted: s.muted,
        shuffle: s.shuffle,
        repeat: s.repeat,
        flow: s.flow,
      }),
    },
  ),
)
