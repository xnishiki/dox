import { create } from 'zustand'
import { tr } from '../i18n'
import { usePlayer } from '../store/player'
import { useTaste } from '../store/taste'
import { useUi } from '../store/ui'
import { recommend } from './recommend'

interface FlowState {
  loading: boolean
  error: string | null
}
export const useFlow = create<FlowState>()(() => ({ loading: false, error: null }))

let inflight: Promise<void> | null = null

function excludeSet() {
  const { queue } = usePlayer.getState()
  const { events } = useTaste.getState()
  return new Set([...queue.map((t) => t.id), ...events.slice(-300).map((e) => e.t)])
}

async function fetchBatch(count = 10) {
  const { events, disliked, prefs } = useTaste.getState()
  return recommend({ events, disliked, prefs, exclude: excludeSet(), count })
}

/** Запустить «Поток» с нуля (например, после смены настроек) */
export async function startFlow() {
  if (inflight) return inflight
  useFlow.setState({ loading: true, error: null })
  inflight = (async () => {
    try {
      const batch = await fetchBatch(10)
      if (!batch.length) throw new Error(tr('Не удалось подобрать треки — проверь ключ Jamendo и интернет', 'Could not find tracks — check your Jamendo key and connection'))
      usePlayer.getState().playTracks(batch, 0, { flow: true })
    } catch (err) {
      const msg = (err as Error).message
      useFlow.setState({ error: msg })
      useUi.getState().showToast(msg)
    } finally {
      useFlow.setState({ loading: false })
      inflight = null
    }
  })()
  return inflight
}

/** Дизлайк в «Потоке»: учитываем и сразу переключаем */
export function dislikeCurrent() {
  const p = usePlayer.getState()
  const t = p.current()
  if (!t) return
  useTaste.getState().record(t, 'dislike')
  useUi.getState().showToast(tr('Понятно, такое больше не ставим', 'Got it, less like this'))
  p.next()
}

/** Пока играет «Поток», очередь пополняется заранее — волна бесконечна */
export function initFlow() {
  let retryAfter = 0
  usePlayer.subscribe((s) => {
    if (!s.flow || inflight || Date.now() < retryAfter) return
    if (s.queue.length - s.index > 3) return
    useFlow.setState({ loading: true })
    inflight = fetchBatch(8)
      .then((batch) => {
        if (!batch.length) { retryAfter = Date.now() + 20_000; return }
        if (usePlayer.getState().flow) usePlayer.getState().addToQueue(batch)
      })
      .catch(() => { retryAfter = Date.now() + 20_000 })
      .finally(() => { inflight = null; useFlow.setState({ loading: false }) })
  })
}
