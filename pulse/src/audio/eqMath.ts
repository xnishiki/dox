import { EQ_FREQS } from './engine'

/**
 * Расчёт АЧХ эквалайзера по формулам RBJ Audio EQ Cookbook — те же фильтры, что и BiquadFilterNode.
 * Считаем сами, чтобы график работал ещё до первого воспроизведения.
 */
const Q = 1.1
const SR = 48000

function biquadDb(type: 'lowshelf' | 'peaking' | 'highshelf', f0: number, gainDb: number, f: number): number {
  if (Math.abs(gainDb) < 0.01) return 0
  const A = 10 ** (gainDb / 40)
  const w0 = (2 * Math.PI * f0) / SR
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number
  if (type === 'peaking') {
    const alpha = sin / (2 * Q)
    b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A
    a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A
  } else {
    // Web Audio использует для полок S = 1
    const alpha = (sin / 2) * Math.sqrt(2)
    const sq = 2 * Math.sqrt(A) * alpha
    if (type === 'lowshelf') {
      b0 = A * (A + 1 - (A - 1) * cos + sq); b1 = 2 * A * (A - 1 - (A + 1) * cos); b2 = A * (A + 1 - (A - 1) * cos - sq)
      a0 = A + 1 + (A - 1) * cos + sq; a1 = -2 * (A - 1 + (A + 1) * cos); a2 = A + 1 + (A - 1) * cos - sq
    } else {
      b0 = A * (A + 1 + (A - 1) * cos + sq); b1 = -2 * A * (A - 1 + (A + 1) * cos); b2 = A * (A + 1 + (A - 1) * cos - sq)
      a0 = A + 1 - (A - 1) * cos + sq; a1 = 2 * (A - 1 - (A + 1) * cos); a2 = A + 1 - (A - 1) * cos - sq
    }
  }
  const w = (2 * Math.PI * f) / SR
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w)
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2)
  const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2)
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di))
}

/** Точки графика: частоты от 20 Гц до 20 кГц по логарифмической шкале */
export function responseCurve(gains: number[], preampDb: number, points = 160): Array<{ f: number; db: number }> {
  const out: Array<{ f: number; db: number }> = []
  for (let i = 0; i < points; i++) {
    const f = 20 * Math.pow(1000, i / (points - 1))
    let db = preampDb
    EQ_FREQS.forEach((f0, b) => {
      const type = b === 0 ? 'lowshelf' : b === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking'
      db += biquadDb(type, f0, gains[b] ?? 0, f)
    })
    out.push({ f, db })
  }
  return out
}
