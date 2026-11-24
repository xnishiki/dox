import { create } from 'zustand'
import type { UpdateStatus } from '../../electron/update-types'
import { engine } from '../audio/engine'
import { pulse } from '../lib/platform'
import { usePlayer } from './player'

const RESUME_KEY = 'pulse.resumeAfterUpdate'
const DISMISSED_KEY = 'pulse.updateDismissed'

interface UpdatesState {
  status: UpdateStatus | null
  /** Версия, для которой нажали «Позже» — уведомление больше не всплывает само */
  dismissed: string | null
  /** Показать уведомление снова (по клику на значок в боковой панели) */
  reopen: () => void
  later: () => void
  restartAndUpdate: () => Promise<void>
}

const readDismissed = () => { try { return localStorage.getItem(DISMISSED_KEY) } catch { return null } }

export const useUpdates = create<UpdatesState>()((set, get) => ({
  status: null,
  dismissed: readDismissed(),

  reopen: () => {
    try { localStorage.removeItem(DISMISSED_KEY) } catch { /* ignore */ }
    set({ dismissed: null })
  },

  later: () => {
    const v = get().status?.version ?? null
    try { if (v) localStorage.setItem(DISMISSED_KEY, v) } catch { /* ignore */ }
    set({ dismissed: v })
    void pulse?.updates.later()
  },

  restartAndUpdate: async () => {
    // Сохраняем всё, чтобы после обновления продолжить с того же места:
    // очередь, трек и громкость уже лежат в localStorage (zustand persist), досохраняем точную позицию.
    const p = usePlayer.getState()
    p._sync({ position: engine.audio.currentTime || p.position })
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ at: Date.now(), playing: p.playing }))
    } catch { /* ignore */ }
    await pulse?.updates.install()
  },
}))

/** Подписка на статус из главного процесса */
export function initUpdates() {
  if (!pulse) return
  pulse.updates.getStatus().then((status) => useUpdates.setState({ status })).catch(() => {})
  pulse.updates.onStatus((status) => useUpdates.setState({ status }))
  window.addEventListener('online', () => pulse?.updates.notifyOnline())
}

/**
 * Если приложение перезапустилось ради обновления — вернуть воспроизведение.
 * Вызывается после восстановления плеера (трек и позиция уже загружены).
 */
export function consumeResumeFlag(): boolean {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return false
    localStorage.removeItem(RESUME_KEY)
    const { at, playing } = JSON.parse(raw) as { at: number; playing: boolean }
    // Обновление ставится за секунды; старый флаг (например, после сбоя) игнорируем
    return playing && Date.now() - at < 10 * 60 * 1000
  } catch {
    return false
  }
}
