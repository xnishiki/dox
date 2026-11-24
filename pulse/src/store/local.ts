import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '../lib/types'
import { pulse } from '../lib/platform'
import { tr } from '../i18n'

interface LocalState {
  folder: string | null
  tracks: Track[]
  scanning: boolean
  progress: { done: number; total: number } | null
  error: string | null
  pickFolder: () => Promise<void>
  rescan: () => Promise<void>
  forget: () => Promise<void>
}

export const useLocal = create<LocalState>()(
  persist(
    (set, get) => ({
      folder: null,
      tracks: [],
      scanning: false,
      progress: null,
      error: null,

      pickFolder: async () => {
        if (!pulse) { set({ error: tr('Локальные файлы доступны только в приложении', 'Local files work only in the desktop app') }); return }
        const folder = await pulse.local.pickFolder()
        if (!folder) return
        set({ folder })
        await get().rescan()
      },

      rescan: async () => {
        if (!pulse || get().scanning) return
        set({ scanning: true, error: null, progress: null })
        const off = pulse.local.onProgress((progress) => set({ progress }))
        try {
          const { folder, tracks } = await pulse.local.scan()
          set({ folder, tracks: tracks as Track[] })
        } catch (err) {
          set({ error: (err as Error).message })
        } finally {
          off()
          set({ scanning: false, progress: null })
        }
      },

      forget: async () => {
        await pulse?.local.forget()
        set({ folder: null, tracks: [] })
      },
    }),
    { name: 'pulse.local', partialize: (s) => ({ folder: s.folder, tracks: s.tracks }) },
  ),
)
