import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cn } from '../lib/format'

export function Modal({ open, onClose, title, children, width = 460 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="relative max-h-[calc(100vh-48px)] w-full overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-soft"
            style={{ maxWidth: width }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[20px] font-extrabold tracking-tight">{title}</h2>
              <button className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[12.5px] font-bold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-faint">{hint}</span>}
    </label>
  )
}

export const inputCls = 'h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-sun/70'

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled, className }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-[13.5px] font-bold transition active:scale-[.97] disabled:opacity-50',
        variant === 'primary' && 'bg-brand text-[#1b1208]',
        variant === 'ghost' && 'bg-elev text-fg hover:bg-hover',
        variant === 'danger' && 'bg-[#e5484d]/15 text-[#ff6369] hover:bg-[#e5484d]/25',
        className,
      )}
    >
      {children}
    </button>
  )
}
