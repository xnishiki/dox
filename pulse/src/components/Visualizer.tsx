import { useEffect, useRef } from 'react'
import { engine } from '../audio/engine'
import { usePlayer } from '../store/player'

/**
 * Круговая визуализация вокруг кнопки «Потока»: столбики реагируют на музыку через AnalyserNode.
 * Когда ничего не играет — спокойно «дышит».
 */
export function Visualizer({ size = 320, bars = 72, inner = 0.36, className }: { size?: number; bars?: number; inner?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const playingRef = useRef(false)
  const playing = usePlayer((s) => s.playing)
  playingRef.current = playing

  useEffect(() => {
    const canvas = ref.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const levels = new Float32Array(bars)
    let data: Uint8Array<ArrayBuffer> | null = null
    let raf = 0
    const c = size / 2
    const r0 = size * inner

    const grad = ctx.createLinearGradient(0, 0, size, size)
    grad.addColorStop(0, '#FFC83D')
    grad.addColorStop(1, '#FF6A3D')

    const draw = (time: number) => {
      const an = engine.analyser
      const live = playingRef.current && an
      if (live) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(data)
      }
      ctx.clearRect(0, 0, size, size)
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(2, (Math.PI * 2 * r0) / bars * 0.45)
      ctx.strokeStyle = grad
      for (let i = 0; i < bars; i++) {
        // Симметрия: левая половина — зеркало правой, низкие частоты сверху
        const k = i < bars / 2 ? i : bars - 1 - i
        let target: number
        if (live && data) {
          // Логарифмически распределяем бины: басам больше столбиков
          // Первые бины (почти постоянная составляющая) пропускаем — иначе сверху всегда «усы»
          const t = k / (bars / 2)
          const idx = Math.floor(3 + Math.pow(t, 1.8) * (data.length * 0.55 - 3))
          // Высокие частоты тише по природе — слегка подтягиваем их
          target = Math.min(1, (data[idx] / 255) * (0.75 + 0.6 * t))
        } else {
          target = reduced ? 0.15 : 0.12 + 0.08 * Math.sin(time / 700 + k * 0.35)
        }
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.45 : 0.12)
        const len = 4 + levels[i] * size * 0.17
        const a = (i / bars) * Math.PI * 2 - Math.PI / 2
        const cos = Math.cos(a), sin = Math.sin(a)
        ctx.globalAlpha = 0.35 + levels[i] * 0.65
        ctx.beginPath()
        ctx.moveTo(c + cos * r0, c + sin * r0)
        ctx.lineTo(c + cos * (r0 + len), c + sin * (r0 + len))
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size, bars, inner])

  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden />
}
