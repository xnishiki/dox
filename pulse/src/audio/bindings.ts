import { engine } from './engine'
import { usePlayer } from '../store/player'
import { pulse } from '../lib/platform'
import { useTaste } from '../store/taste'
import type { QueueItem } from '../store/player'

/** Подключает звуковой движок к хранилищу, Media Session (медиаклавиши, уведомление Windows) и трею. Вызывается один раз. */
export function initAudioBindings() {
  const a = engine.audio
  const store = usePlayer
  const sync = (p: Parameters<ReturnType<typeof store.getState>['_sync']>[0]) => store.getState()._sync(p)

  // --- события <audio> ---
  a.addEventListener('play', () => sync({ playing: true }))
  a.addEventListener('pause', () => sync({ playing: false, position: a.currentTime }))
  a.addEventListener('waiting', () => sync({ buffering: true }))
  a.addEventListener('playing', () => sync({ buffering: false }))
  a.addEventListener('canplay', () => sync({ buffering: false }))
  a.addEventListener('loadedmetadata', () => { if (Number.isFinite(a.duration)) sync({ duration: a.duration }) })
  // --- учёт прослушиваний для «Потока»: дослушал или пропустил ---
  let listened: { track: QueueItem; pos: number; dur: number; ended: boolean; played: boolean } | null = null
  a.addEventListener('playing', () => { if (listened) listened.played = true })
  a.addEventListener('timeupdate', () => {
    if (listened && Number.isFinite(a.duration)) { listened.pos = a.currentTime; listened.dur = a.duration }
  })
  const evaluateListen = () => {
    if (!listened) return
    const { track, pos, dur, ended, played } = listened
    listened = null
    if (!played) return
    if (ended || (dur > 0 && pos / dur >= 0.85)) useTaste.getState().record(track, 'complete')
    else if (dur > 0 && pos < Math.min(30, dur * 0.5)) useTaste.getState().record(track, 'skip')
  }
  a.addEventListener('ended', () => {
    if (listened) listened.ended = true
    store.getState().next(true)
  })
  a.addEventListener('seeked', () => sync({ position: a.currentTime }))

  let lastSaved = 0
  a.addEventListener('timeupdate', () => {
    // Позицию для восстановления сохраняем не чаще раза в 2 секунды
    if (Math.abs(a.currentTime - lastSaved) >= 2) {
      lastSaved = a.currentTime
      sync({ position: a.currentTime })
    }
    updatePositionState()
  })

  let errorStreak = 0
  a.addEventListener('playing', () => { errorStreak = 0 })
  a.addEventListener('error', () => {
    if (!a.getAttribute('src')) return
    errorStreak++
    sync({ playing: false, buffering: false, error: 'Не удалось воспроизвести трек' })
    // Пропускаем битый трек, но не уходим в бесконечный цикл, если пропала сеть
    if (errorStreak < 3) setTimeout(() => store.getState().next(true), 900)
  })

  // --- восстановление после перезапуска: тот же трек, та же позиция, без автозапуска ---
  const s = store.getState()
  engine.setVolume(s.volume, s.muted)
  const cur = s.current()
  if (cur) {
    engine.load(cur.src, s.position)
    sync({ duration: cur.duration, playing: false })
  }

  // --- Media Session: медиаклавиши и плитка управления в Windows ---
  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null
  function updatePositionState() {
    if (!ms?.setPositionState || !Number.isFinite(a.duration) || a.duration <= 0) return
    try { ms.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate }) } catch { /* ignore */ }
  }
  if (ms) {
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => store.getState().toggle()],
      ['pause', () => engine.pause()],
      ['nexttrack', () => store.getState().next()],
      ['previoustrack', () => store.getState().prev()],
      ['seekto', (d) => d.seekTime != null && store.getState().seek(d.seekTime)],
      ['seekforward', (d) => store.getState().seek(a.currentTime + (d.seekOffset ?? 10))],
      ['seekbackward', (d) => store.getState().seek(a.currentTime - (d.seekOffset ?? 10))],
    ]
    for (const [action, handler] of actions) {
      try { ms.setActionHandler(action, handler) } catch { /* действие не поддерживается */ }
    }
  }

  // --- реакция на смену трека / состояния ---
  let lastId: string | undefined
  let lastPlaying: boolean | undefined
  const onChange = () => {
    const st = store.getState()
    const t = st.current()
    const trackChanged = t?.qid !== lastId
    if (trackChanged) {
      evaluateListen()
      if (t) listened = { track: t, pos: 0, dur: t.duration, ended: false, played: false }
      lastId = t?.qid
      if (ms) {
        ms.metadata = t
          ? new MediaMetadata({
              title: t.title,
              artist: t.artist,
              album: t.album ?? '',
              artwork: t.cover ? [{ src: t.cover, sizes: '300x300', type: 'image/jpeg' }] : [],
            })
          : null
      }
      document.title = t ? `${t.title} — ${t.artist}` : 'Pulse'
    }
    if (ms) ms.playbackState = st.playing ? 'playing' : t ? 'paused' : 'none'
    if (trackChanged || st.playing !== lastPlaying) {
      lastPlaying = st.playing
      pulse?.tray.update({ playing: st.playing, title: t ? `${t.artist} — ${t.title}` : '' })
    }
  }
  store.subscribe(onChange)
  onChange()

  // --- команды из меню трея ---
  pulse?.tray.onCommand((cmd) => {
    const st = store.getState()
    if (cmd === 'toggle') st.toggle()
    else if (cmd === 'next') st.next()
    else st.prev()
  })
}
