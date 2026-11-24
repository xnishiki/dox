import { useEffect, useState } from 'react'

export interface CoverColors {
  primary: string
  secondary: string
  /** Светлая ли обложка — чтобы подобрать контрастный текст */
  light: boolean
}

const FALLBACK: CoverColors = { primary: 'rgb(255,138,61)', secondary: 'rgb(60,30,20)', light: false }
const cache = new Map<string, CoverColors>()

/** Берёт два доминирующих цвета обложки (уменьшаем картинку до 24×24 и группируем пиксели по оттенку) */
export function extractColors(img: HTMLImageElement): CoverColors {
  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return FALLBACK
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  const buckets = new Map<number, { r: number; g: number; b: number; n: number; score: number }>()
  let lum = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, score: 0 }
    bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++
    // Насыщенные и не слишком тёмные цвета ценнее серых
    bucket.score += 0.3 + sat * (max / 255)
    buckets.set(key, bucket)
  }
  const sorted = [...buckets.values()].sort((a, b) => b.score - a.score)
  const toRgb = (c?: { r: number; g: number; b: number; n: number }) =>
    c ? `rgb(${Math.round(c.r / c.n)},${Math.round(c.g / c.n)},${Math.round(c.b / c.n)})` : FALLBACK.secondary
  return {
    primary: toRgb(sorted[0]),
    secondary: toRgb(sorted.find((c, i) => i > 0 && Math.abs(c.r / c.n - sorted[0].r / sorted[0].n) + Math.abs(c.g / c.n - sorted[0].g / sorted[0].n) + Math.abs(c.b / c.n - sorted[0].b / sorted[0].n) > 90) ?? sorted[1]),
    light: lum / (size * size) > 165,
  }
}

export function useCoverColors(src?: string): CoverColors {
  const [colors, setColors] = useState<CoverColors>(() => (src && cache.get(src)) || FALLBACK)
  useEffect(() => {
    if (!src) return setColors(FALLBACK)
    const cached = cache.get(src)
    if (cached) return setColors(cached)
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = extractColors(img)
        cache.set(src, c)
        if (alive) setColors(c)
      } catch {
        if (alive) setColors(FALLBACK)
      }
    }
    img.onerror = () => alive && setColors(FALLBACK)
    img.src = src
    return () => { alive = false }
  }, [src])
  return colors
}
