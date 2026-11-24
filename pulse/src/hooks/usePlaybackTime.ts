import { useEffect, useState } from 'react'
import { engine } from '../audio/engine'

/** Текущее время и длительность трека для прогресс-бара (обновляется ~4 раза в секунду, без перерисовки всего приложения) */
export function usePlaybackTime() {
  const a = engine.audio
  const read = () => ({ time: a.currentTime || 0, duration: Number.isFinite(a.duration) ? a.duration : 0 })
  const [state, setState] = useState(read)
  useEffect(() => {
    const update = () => setState(read())
    const events = ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked', 'emptied'] as const
    events.forEach((e) => a.addEventListener(e, update))
    return () => events.forEach((e) => a.removeEventListener(e, update))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}
