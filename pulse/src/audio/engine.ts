/**
 * Аудиодвижок на Web Audio API.
 * Цепочка: <audio> → предусилитель → 10 полос эквалайзера (BiquadFilter) → анализатор → колонки.
 * Граф создаётся при первом воспроизведении: браузер разрешает звук только после действия пользователя.
 */
export const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const EQ_RANGE = 12

type Listener = () => void

class AudioEngine {
  readonly audio: HTMLAudioElement
  private ctx: AudioContext | null = null
  private preamp: GainNode | null = null
  private bands: BiquadFilterNode[] = []
  private analyserNode: AnalyserNode | null = null
  private gains: number[] = EQ_FREQS.map(() => 0)
  private preampDb = 0
  private eqEnabled = true
  private graphListeners = new Set<Listener>()

  constructor() {
    this.audio = new Audio()
    this.audio.crossOrigin = 'anonymous'
    this.audio.preload = 'auto'
  }

  private ensureGraph() {
    if (this.ctx) return
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(this.audio)
      const preamp = ctx.createGain()
      const bands = EQ_FREQS.map((f, i) => {
        const b = ctx.createBiquadFilter()
        b.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking'
        b.frequency.value = f
        b.Q.value = 1.1
        return b
      })
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8

      source.connect(preamp)
      let node: AudioNode = preamp
      for (const b of bands) { node.connect(b); node = b }
      node.connect(analyser)
      analyser.connect(ctx.destination)

      this.ctx = ctx
      this.preamp = preamp
      this.bands = bands
      this.analyserNode = analyser
      this.applyEq()
      this.graphListeners.forEach((l) => l())
    } catch (err) {
      console.warn('Web Audio недоступен, играем без эквалайзера', err)
    }
  }

  private applyEq() {
    if (!this.ctx || !this.preamp) return
    const t = this.ctx.currentTime
    const on = this.eqEnabled
    this.preamp.gain.setTargetAtTime(on ? 10 ** (this.preampDb / 20) : 1, t, 0.02)
    this.bands.forEach((b, i) => b.gain.setTargetAtTime(on ? this.gains[i] : 0, t, 0.02))
  }

  private pendingSeek: { at: number; cleanup: () => void } | null = null

  load(src: string, startAt = 0) {
    this.pendingSeek?.cleanup()
    this.pendingSeek = null
    if (this.audio.src !== src) {
      this.audio.src = src
      this.audio.load()
    }
    if (startAt > 0) this.seekWhenReady(startAt)
  }

  /**
   * Перемотка сразу после загрузки: некоторые серверы не дают перематывать, пока данные не скачаны,
   * поэтому пробуем на нескольких событиях, пока позиция не установится.
   */
  private seekWhenReady(at: number) {
    const a = this.audio
    const events = ['loadedmetadata', 'canplay', 'canplaythrough', 'progress'] as const
    const attempt = () => {
      if (a.readyState < 1) return
      if (Math.abs(a.currentTime - at) < 0.5) return done()
      a.currentTime = at
      if (Math.abs(a.currentTime - at) < 0.5) done()
    }
    const lastTry = () => { attempt(); done() }
    const done = () => {
      events.forEach((e) => a.removeEventListener(e, attempt))
      a.removeEventListener('playing', lastTry)
      if (this.pendingSeek?.at === at) this.pendingSeek = null
    }
    events.forEach((e) => a.addEventListener(e, attempt))
    // Запустили воспроизведение раньше, чем удалось перемотать, — последняя попытка
    a.addEventListener('playing', lastTry)
    this.pendingSeek = { at, cleanup: done }
    attempt()
  }

  async play() {
    this.ensureGraph()
    if (this.ctx?.state === 'suspended') await this.ctx.resume().catch(() => {})
    try {
      await this.audio.play()
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') throw err
    }
  }

  pause() { this.audio.pause() }
  stop() { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load() }
  seek(t: number) {
    if (!Number.isFinite(t)) return
    this.pendingSeek?.cleanup()
    this.audio.currentTime = Math.max(0, t)
  }
  setVolume(v: number, muted: boolean) {
    // Кубическая кривая: на слух громкость меняется равномернее, чем при линейной
    this.audio.volume = Math.max(0, Math.min(1, v)) ** 3
    this.audio.muted = muted
  }

  get analyser() { return this.analyserNode }
  get sampleRate() { return this.ctx?.sampleRate ?? 48000 }
  onGraphReady(l: Listener) { this.graphListeners.add(l); return () => { this.graphListeners.delete(l) } }

  // --- эквалайзер (интерфейс появится на этапе 3) ---
  setEq(gains: number[], preampDb: number, enabled: boolean) {
    this.gains = EQ_FREQS.map((_, i) => gains[i] ?? 0)
    this.preampDb = preampDb
    this.eqEnabled = enabled
    this.applyEq()
  }
}

export const engine = new AudioEngine()
