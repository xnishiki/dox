import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { EQ_FREQS, EQ_RANGE } from '../audio/engine'
import { responseCurve } from '../audio/eqMath'
import { useTr } from '../i18n'
import { cn } from '../lib/format'
import { BUILTIN_PRESETS, useEq } from '../store/eq'
import { useUi } from '../store/ui'

const fmtFreq = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f))
const fmtDb = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(v % 1 ? 1 : 0)}`

/** Вертикальный ползунок: перетаскивание, колесо мыши, стрелки, двойной клик — сброс в 0 */
function VSlider({ value, onChange, label, disabled, height = 168 }: { value: number; onChange: (v: number) => void; label: string; disabled?: boolean; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = (value + EQ_RANGE) / (2 * EQ_RANGE)
  const fromPointer = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const p = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    onChange(p * 2 * EQ_RANGE - EQ_RANGE)
  }
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 3 : 0.5
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(value + step) }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(value - step) }
    if (e.key === 'Home' || e.key === '0') onChange(0)
  }
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={-EQ_RANGE}
      aria-valuemax={EQ_RANGE}
      aria-valuenow={value}
      aria-valuetext={`${fmtDb(value)} дБ`}
      className={cn('group relative w-8 cursor-ns-resize touch-none outline-none', disabled && 'opacity-40')}
      style={{ height }}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); fromPointer(e) }}
      onPointerMove={(e) => { if (e.buttons === 1) fromPointer(e) }}
      onWheel={(e) => onChange(value + (e.deltaY < 0 ? 0.5 : -0.5))}
      onDoubleClick={() => onChange(0)}
      onKeyDown={onKey}
    >
      <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-hover" />
      <div className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 bg-faint/60" />
      {/* Заливка от нуля до значения */}
      <div
        className="bg-brand absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full"
        style={pct >= 0.5 ? { bottom: '50%', height: `${(pct - 0.5) * 100}%` } : { top: '50%', height: `${(0.5 - pct) * 100}%` }}
      />
      <div
        className="absolute left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-sun bg-fg shadow transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-sun"
        style={{ bottom: `${pct * 100}%` }}
      />
    </div>
  )
}

function ResponseGraph({ gains, preamp, enabled }: { gains: number[]; preamp: number; enabled: boolean }) {
  const W = 600, H = 150, RANGE = 18
  const curve = useMemo(() => responseCurve(enabled ? gains : gains.map(() => 0), enabled ? preamp : 0), [gains, preamp, enabled])
  const x = (f: number) => (Math.log10(f / 20) / 3) * W
  const y = (db: number) => H / 2 - (Math.max(-RANGE, Math.min(RANGE, db)) / RANGE) * (H / 2 - 6)
  const d = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.f).toFixed(1)},${y(p.db).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" preserveAspectRatio="none" role="img" aria-label="График АЧХ">
      <defs>
        <linearGradient id="eq-stroke" x1="0" x2="1">
          <stop offset="0" stopColor="#FFC83D" />
          <stop offset="1" stopColor="#FF6A3D" />
        </linearGradient>
        <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FF8A3D" stopOpacity=".28" />
          <stop offset="1" stopColor="#FF8A3D" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[12, 6, 0, -6, -12].map((db) => (
        <g key={db}>
          <line x1={0} x2={W} y1={y(db)} y2={y(db)} stroke="var(--line)" strokeWidth={db === 0 ? 1.5 : 1} vectorEffect="non-scaling-stroke" />
          <text x={4} y={y(db) - 3} fontSize={10} fill="var(--faint)">{fmtDb(db)}</text>
        </g>
      ))}
      {EQ_FREQS.map((f) => <line key={f} x1={x(f)} x2={x(f)} y1={0} y2={H} stroke="var(--line)" vectorEffect="non-scaling-stroke" />)}
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#eq-fill)" opacity={enabled ? 1 : 0.3} />
      <path d={d} fill="none" stroke={enabled ? 'url(#eq-stroke)' : 'var(--faint)'} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function EqPanel() {
  const L = useTr()
  const open = useUi((s) => s.eqOpen)
  const setOpen = useUi((s) => s.setEqOpen)
  const eq = useEq()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const presets = [...BUILTIN_PRESETS, ...eq.customPresets]

  const save = () => {
    if (!name.trim()) return
    eq.savePreset(name.trim().slice(0, 30))
    setName('')
    setSaving(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.section
            role="dialog"
            aria-label={L('Эквалайзер', 'Equalizer')}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed bottom-[100px] left-1/2 z-[61] w-[min(760px,calc(100vw-32px))] -translate-x-1/2 rounded-3xl border border-line bg-surface p-5 shadow-soft"
          >
            <header className="mb-3 flex items-center gap-3">
              <h2 className="text-[18px] font-extrabold">{L('Эквалайзер', 'Equalizer')}</h2>
              <button
                role="switch"
                aria-checked={eq.enabled}
                onClick={() => eq.setEnabled(!eq.enabled)}
                className={cn('relative h-6 w-11 rounded-full transition-colors', eq.enabled ? 'bg-mint' : 'bg-hover')}
                aria-label={L('Включить эквалайзер', 'Enable equalizer')}
              >
                <motion.span layout className="absolute top-0.5 size-5 rounded-full bg-white shadow" style={{ left: eq.enabled ? 22 : 2 }} />
              </button>
              <span className="text-[12.5px] text-muted">{eq.enabled ? L('Включён', 'On') : L('Выключен', 'Off')}</span>
              <button className="ml-auto grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" onClick={() => setOpen(false)} aria-label={L('Закрыть', 'Close')}>
                <X size={18} />
              </button>
            </header>

            <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {presets.map((p) => (
                <span key={p.id} className="group relative shrink-0">
                  <button
                    onClick={() => eq.applyPreset(p)}
                    className={cn('rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors', eq.presetId === p.id ? 'border-transparent bg-fg text-bg' : 'border-line text-muted hover:text-fg')}
                  >
                    {L(p.ru, p.en)}
                  </button>
                  {p.custom && (
                    <button onClick={() => eq.deletePreset(p.id)} className="absolute -right-1 -top-1 hidden size-5 place-items-center rounded-full bg-elev text-muted shadow hover:text-[#e5484d] group-hover:grid" aria-label={L('Удалить пресет', 'Delete preset')}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </span>
              ))}
              {saving ? (
                <form onSubmit={(e) => { e.preventDefault(); save() }} className="flex shrink-0 items-center gap-1">
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !name && setSaving(false)} placeholder={L('Название', 'Name')} className="h-8 w-32 rounded-full border border-sun/60 bg-bg px-3 text-[12.5px] outline-none" maxLength={30} />
                  <button type="submit" className="h-8 rounded-full bg-sun px-3 text-[12.5px] font-bold text-[#1b1208]">OK</button>
                </form>
              ) : (
                <button onClick={() => setSaving(true)} className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-fg">
                  <Plus size={14} /> {L('Сохранить пресет', 'Save preset')}
                </button>
              )}
            </div>

            <div className="mb-3 rounded-2xl bg-bg px-2 pt-2">
              <ResponseGraph gains={eq.gains} preamp={eq.preamp} enabled={eq.enabled} />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex flex-col items-center gap-2 border-r border-line pr-3">
                <span className="text-[11px] tabular-nums text-muted">{fmtDb(eq.preamp)}</span>
                <VSlider value={eq.preamp} onChange={eq.setPreamp} label={L('Предусилитель', 'Preamp')} disabled={!eq.enabled} />
                <span className="text-[11px] font-bold text-faint">PRE</span>
              </div>
              <div className="grid flex-1 grid-cols-10">
                {EQ_FREQS.map((f, i) => (
                  <div key={f} className="flex flex-col items-center gap-2">
                    <span className="text-[11px] tabular-nums text-muted">{fmtDb(eq.gains[i])}</span>
                    <VSlider value={eq.gains[i]} onChange={(v) => eq.setBand(i, v)} label={`${fmtFreq(f)} Гц`} disabled={!eq.enabled} />
                    <span className="text-[11px] font-bold text-faint">{fmtFreq(f)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-[11.5px] text-faint">{L('Двойной клик по ползунку — сброс в 0 дБ, колесо мыши — точная настройка', 'Double-click a slider to reset, scroll for fine tuning')}</p>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
