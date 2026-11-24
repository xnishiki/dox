import { ArrowDownToLine, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTr } from '../i18n'
import { useUpdates } from '../store/updates'

/** Маленький значок в боковой панели: кольцо прогресса во время загрузки, искра — когда обновление готово */
export function UpdateBadge() {
  const L = useTr()
  const navigate = useNavigate()
  const status = useUpdates((s) => s.status)
  const reopen = useUpdates((s) => s.reopen)
  if (!status) return null

  if (status.state === 'downloading') {
    const pct = Math.max(0, Math.min(100, status.progress?.percent ?? 0))
    const r = 8, c = 2 * Math.PI * r
    return (
      <button
        onClick={() => navigate('/settings#updates')}
        className="grid size-7 place-items-center rounded-full text-muted hover:bg-elev hover:text-fg"
        title={L(`Загружается обновление ${status.version ?? ''}: ${Math.round(pct)}%`, `Downloading update ${status.version ?? ''}: ${Math.round(pct)}%`)}
        aria-label={L(`Загрузка обновления, ${Math.round(pct)}%`, `Downloading update, ${Math.round(pct)}%`)}
      >
        <svg viewBox="0 0 20 20" className="size-5 -rotate-90">
          <circle cx="10" cy="10" r={r} fill="none" stroke="var(--hover)" strokeWidth="2.5" />
          <circle cx="10" cy="10" r={r} fill="none" stroke="#FF8A3D" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .4s' }} />
        </svg>
      </button>
    )
  }

  const ready = (status.mode === 'nsis' && status.state === 'downloaded') || (status.mode === 'portable' && status.state === 'available')
  if (ready) {
    return (
      <button
        onClick={reopen}
        className="relative grid size-7 place-items-center rounded-full text-mint hover:bg-elev"
        title={L(`Готово обновление ${status.version}`, `Update ${status.version} is ready`)}
        aria-label={L('Обновление готово', 'Update ready')}
      >
        {status.mode === 'portable' ? <ArrowDownToLine size={16} /> : <Sparkles size={16} />}
        <span className="absolute right-1 top-1 size-1.5 animate-ping rounded-full bg-mint" />
      </button>
    )
  }
  return null
}
