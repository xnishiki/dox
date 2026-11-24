import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '../lib/types'
import { useTaste } from './taste'

interface LibraryState {
  /** Понравившиеся треки, новые — первыми */
  liked: Track[]
  updatedAt: number
  isLiked: (id: string) => boolean
  toggleLike: (track: Track) => void
  _replace: (liked: Track[], updatedAt: number) => void
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      liked: [],
      updatedAt: 0,
      isLiked: (id) => get().liked.some((t) => t.id === id),
      toggleLike: (track) => {
        const was = get().isLiked(track.id)
        const { qid: _qid, ...plain } = track as Track & { qid?: string }
        void _qid
        set((s) => ({
          liked: was ? s.liked.filter((t) => t.id !== track.id) : [plain, ...s.liked],
          updatedAt: Date.now(),
        }))
        useTaste.getState().record(track, was ? 'unlike' : 'like')
      },
      _replace: (liked, updatedAt) => set({ liked, updatedAt }),
    }),
    { name: 'pulse.library', partialize: (s) => ({ liked: s.liked, updatedAt: s.updatedAt }) },
  ),
)
