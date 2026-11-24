import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '../lib/types'

export type TasteEventType = 'complete' | 'skip' | 'like' | 'dislike' | 'unlike'

export interface TasteEvent {
  /** id трека */
  t: string
  /** id исполнителя */
  a?: string
  /** жанры и теги трека */
  g: string[]
  type: TasteEventType
  at: number
}

export type FlowMood = 'any' | 'upbeat' | 'calm' | 'sad'
export type FlowCharacter = 'favorite' | 'new' | 'popular'

export interface FlowPrefs {
  mood: FlowMood
  character: FlowCharacter
  genres: string[]
}

interface TasteState {
  events: TasteEvent[]
  disliked: string[]
  prefs: FlowPrefs
  updatedAt: number
  record: (track: Track, type: TasteEventType) => void
  setPrefs: (p: Partial<FlowPrefs>) => void
  _replace: (s: Pick<TasteState, 'events' | 'disliked' | 'prefs' | 'updatedAt'>) => void
}

const MAX_EVENTS = 600

export const useTaste = create<TasteState>()(
  persist(
    (set) => ({
      events: [],
      disliked: [],
      prefs: { mood: 'any', character: 'favorite', genres: [] },
      updatedAt: 0,
      record: (track, type) => {
        if (track.source !== 'jamendo') return
        const e: TasteEvent = { t: track.id, a: track.artistId, g: [...(track.genres ?? []), ...(track.tags ?? [])].slice(0, 8), type, at: Date.now() }
        set((s) => ({
          events: [...s.events, e].slice(-MAX_EVENTS),
          disliked: type === 'dislike' ? [...new Set([...s.disliked, track.id])].slice(-1000) : type === 'like' ? s.disliked.filter((x) => x !== track.id) : s.disliked,
          updatedAt: Date.now(),
        }))
      },
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p }, updatedAt: Date.now() })),
      _replace: (s) => set(s),
    }),
    { name: 'pulse.taste', partialize: (s) => ({ events: s.events, disliked: s.disliked, prefs: s.prefs, updatedAt: s.updatedAt }) },
  ),
)
