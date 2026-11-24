import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AudioQuality } from '../lib/jamendo'

export type Theme = 'dark' | 'light'
export type Lang = 'ru' | 'en'

interface SettingsState {
  theme: Theme
  lang: Lang
  quality: AudioQuality
  localFolder: string | null
  /** Ключи, введённые в приложении; если пусто — берутся из .env при сборке */
  jamendoClientId: string
  supabaseUrl: string
  supabaseAnonKey: string
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      lang: 'ru',
      quality: 'mp32',
      localFolder: null,
      jamendoClientId: '',
      supabaseUrl: '',
      supabaseAnonKey: '',
      set: (patch) => set(patch),
    }),
    { name: 'pulse.settings', version: 2, migrate: (s) => s as SettingsState },
  ),
)
