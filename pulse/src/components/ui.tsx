import { motion } from 'framer-motion'
import { AlertCircle, KeyRound, Play, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'
import { JamendoError } from '../lib/jamendo'
import { cn } from '../lib/format'

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn('mx-auto w-full max-w-[1400px] px-8 pb-10 pt-6 max-[1100px]:px-6', className)}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-[22px] font-extrabold tracking-tight">{title}</h2>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-surface p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('relative rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors', o.value === value ? 'text-fg' : 'text-muted hover:text-fg')}
        >
          {o.value === value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-lg bg-elev shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function BrandButton({ children, onClick, className, disabled }: { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={cn('bg-brand inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold text-[#1b1208] shadow-[0_8px_24px_rgba(255,106,61,.25)] disabled:opacity-50', className)}
    >
      {children}
    </motion.button>
  )
}

export function PlayAllButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useT()
  return (
    <BrandButton onClick={onClick} disabled={disabled}>
      <Play size={16} className="fill-current" /> {t('home.playAll')}
    </BrandButton>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const t = useT()
  const noKey = error instanceof JamendoError && /ключ/i.test(error.message)
  const Icon = noKey ? KeyRound : AlertCircle
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <Icon className="text-sun" size={28} />
      <p className="max-w-md text-[14px] text-muted">{noKey ? t('state.noKey') : `${t('state.error')}: ${error.message}`}</p>
      {onRetry && !noKey && (
        <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-full bg-elev px-4 py-2 text-[13px] font-semibold hover:bg-hover">
          <RotateCw size={14} /> {t('state.retry')}
        </button>
      )}
    </div>
  )
}
