import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Minus, Square, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { pulse } from '../lib/platform'
import { useT } from '../i18n'

/** Своя полоса заголовка окна: перетаскивание, назад/вперёд, свернуть/развернуть/закрыть */
export function TitleBar() {
  const t = useT()
  const navigate = useNavigate()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    pulse?.window.isMaximized().then(setMaximized)
    return pulse?.window.onMaximized(setMaximized)
  }, [])

  const btn = 'no-drag grid h-full w-12 place-items-center text-muted transition-colors hover:bg-hover hover:text-fg'
  return (
    <header className="drag flex h-10 shrink-0 items-center justify-between bg-bg-2 pl-3" onDoubleClick={() => pulse?.window.toggleMaximize()}>
      <div className="flex items-center gap-1">
        <img src="./icon.png" alt="" className="mr-2 size-5" draggable={false} />
        <span className="mr-4 text-[13px] font-bold tracking-wide">Pulse</span>
        <button className="no-drag grid size-7 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" onClick={() => navigate(-1)} aria-label="Назад">
          <ChevronLeft size={18} />
        </button>
        <button className="no-drag grid size-7 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" onClick={() => navigate(1)} aria-label="Вперёд">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="flex h-full" onDoubleClick={(e) => e.stopPropagation()}>
        <button className={btn} onClick={() => pulse?.window.minimize()} aria-label={t('window.minimize')}>
          <Minus size={16} />
        </button>
        <button className={btn} onClick={() => pulse?.window.toggleMaximize()} aria-label={t('window.maximize')}>
          {maximized ? <Copy size={13} className="-scale-x-100" /> : <Square size={13} />}
        </button>
        <button className={`${btn} hover:!bg-[#e5484d] hover:!text-white`} onClick={() => pulse?.window.close()} aria-label={t('window.close')}>
          <X size={17} />
        </button>
      </div>
    </header>
  )
}
