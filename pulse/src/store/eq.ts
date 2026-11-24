import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { engine, EQ_FREQS, EQ_RANGE } from '../audio/engine'

export interface EqPreset {
  id: string
  ru: string
  en: string
  gains: number[]
  preamp: number
  custom?: boolean
}

//                                   32   64  125  250  500   1k   2k   4k   8k  16k
export const BUILTIN_PRESETS: EqPreset[] = [
  { id: 'flat', ru: 'Ровный', en: 'Flat', preamp: 0, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'bass', ru: 'Бас', en: 'Bass boost', preamp: -4, gains: [7, 6, 4.5, 2, 0, 0, 0, 0, 0, 0] },
  { id: 'rock', ru: 'Рок', en: 'Rock', preamp: -3, gains: [5, 4, 3, 1, -1, -1, 1, 3, 4, 4.5] },
  { id: 'pop', ru: 'Поп', en: 'Pop', preamp: -2, gains: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2] },
  { id: 'jazz', ru: 'Джаз', en: 'Jazz', preamp: -2, gains: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3] },
  { id: 'classical', ru: 'Классика', en: 'Classical', preamp: -2, gains: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
  { id: 'electronic', ru: 'Электроника', en: 'Electronic', preamp: -4, gains: [6, 5, 1, 0, -2, 1, 0, 1, 4, 5] },
  { id: 'vocal', ru: 'Вокал', en: 'Vocal', preamp: -2, gains: [-2, -3, -2, 1, 3.5, 4, 3, 1.5, 0, -1] },
  { id: 'headphones', ru: 'Для наушников', en: 'Headphones', preamp: -3, gains: [4, 2.5, 1, 0, -1, 0, 1.5, 3, 3.5, 2] },
]

interface EqState {
  enabled: boolean
  preamp: number
  gains: number[]
  presetId: string | null
  customPresets: EqPreset[]
  setEnabled: (v: boolean) => void
  setBand: (i: number, db: number) => void
  setPreamp: (db: number) => void
  applyPreset: (p: EqPreset) => void
  savePreset: (name: string) => void
  deletePreset: (id: string) => void
}

const clampDb = (v: number) => Math.max(-EQ_RANGE, Math.min(EQ_RANGE, Math.round(v * 2) / 2))

export const useEq = create<EqState>()(
  persist(
    (set, get) => ({
      enabled: true,
      preamp: 0,
      gains: EQ_FREQS.map(() => 0),
      presetId: 'flat',
      customPresets: [],
      setEnabled: (enabled) => set({ enabled }),
      setBand: (i, db) => set((s) => {
        const gains = [...s.gains]
        gains[i] = clampDb(db)
        return { gains, presetId: null }
      }),
      setPreamp: (db) => set({ preamp: clampDb(db), presetId: null }),
      applyPreset: (p) => set({ gains: [...p.gains], preamp: p.preamp, presetId: p.id, enabled: true }),
      savePreset: (name) => {
        const p: EqPreset = { id: `custom-${Date.now().toString(36)}`, ru: name, en: name, gains: [...get().gains], preamp: get().preamp, custom: true }
        set((s) => ({ customPresets: [...s.customPresets, p], presetId: p.id }))
      },
      deletePreset: (id) => set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id), presetId: s.presetId === id ? null : s.presetId })),
    }),
    { name: 'pulse.eq' },
  ),
)

/** Любое изменение настроек сразу уходит в звуковой движок */
export function initEqBinding() {
  const apply = () => {
    const s = useEq.getState()
    engine.setEq(s.gains, s.preamp, s.enabled)
  }
  useEq.subscribe(apply)
  apply()
}
