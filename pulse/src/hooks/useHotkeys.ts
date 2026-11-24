import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { engine } from '../audio/engine'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'

/**
 * Пробел — пауза, ←/→ — перемотка на 5 с, ↑/↓ — громкость, Ctrl+F — поиск, Esc — закрыть «Сейчас играет».
 * Медиаклавиши обрабатывает Media Session (см. audio/bindings.ts).
 */
export function useHotkeys() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault()
        useUi.getState().setNowPlaying(false)
        navigate('/search')
        setTimeout(() => document.getElementById('search-input')?.focus(), 30)
        return
      }
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable=true]')) return
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const p = usePlayer.getState()
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          p.toggle()
          break
        case 'ArrowRight':
          e.preventDefault()
          p.seek(Math.min(engine.audio.currentTime + 5, engine.audio.duration || Infinity))
          break
        case 'ArrowLeft':
          e.preventDefault()
          p.seek(Math.max(0, engine.audio.currentTime - 5))
          break
        case 'ArrowUp':
          e.preventDefault()
          p.setVolume(p.volume + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          p.setVolume(p.volume - 0.05)
          break
        case 'Escape': {
          const ui = useUi.getState()
          if (ui.contextMenu) ui.closeContextMenu()
          else if (ui.eqOpen) ui.setEqOpen(false)
          else ui.setNowPlaying(false)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
