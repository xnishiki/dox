import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Page } from '../components/ui'
import { useTr } from '../i18n'
import { parseChangelog } from '../lib/changelog'
import { APP_VERSION } from '../lib/version'

/** «Что нового»: открывается один раз после обновления, потом доступна из настроек */
export default function WhatsNew() {
  const L = useTr()
  const entries = parseChangelog()
  return (
    <Page className="max-w-[820px]">
      <div className="mb-8 flex items-center gap-4">
        <motion.span initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="bg-brand grid size-14 place-items-center rounded-2xl text-[#1b1208] shadow-[0_12px_32px_rgba(255,106,61,.35)]">
          <Sparkles size={26} />
        </motion.span>
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-sun">{L(`Pulse ${APP_VERSION}`, `Pulse ${APP_VERSION}`)}</p>
          <h1 className="text-[34px] font-extrabold tracking-tight">{L('Что нового', 'What’s new')}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {entries.map((e, i) => (
          <motion.section
            key={e.version}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 6) * 0.05 }}
            className={e.version === APP_VERSION ? 'rounded-2xl border border-sun/40 bg-surface p-5' : 'rounded-2xl bg-surface p-5'}
          >
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-[20px] font-extrabold">{e.version}</h2>
              {e.date && <span className="text-[12.5px] tabular-nums text-muted">{e.date}</span>}
              {e.version === APP_VERSION && <span className="rounded-full bg-sun/20 px-2 py-0.5 text-[11px] font-bold text-sun">{L('текущая', 'current')}</span>}
            </div>
            {e.blocks.map((b, j) => (
              <div key={j} className="mb-3 last:mb-0">
                {b.heading && <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-faint">{b.heading}</h3>}
                {b.text.map((t, k) => <p key={k} className="mb-1 text-[14px] text-muted">{t}</p>)}
                {b.items.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {b.items.map((it, k) => (
                      <li key={k} className="flex gap-2.5 text-[14px] leading-relaxed">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ember" aria-hidden />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </motion.section>
        ))}
      </div>
    </Page>
  )
}
