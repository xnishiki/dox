import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, RotateCw, Sparkles, X } from 'lucide-react'
import { useTr } from '../i18n'
import { pulse } from '../lib/platform'
import { useUpdates } from '../store/updates'

/**
 * Аккуратное уведомление над плеером:
 * - установленная версия: обновление скачано → «Перезапустить и обновить» / «Позже»;
 * - portable: найдена новая версия → «Скачать» (страница релиза) / «Позже».
 */
export function UpdateToast() {
  const L = useTr()
  const status = useUpdates((s) => s.status)
  const dismissed = useUpdates((s) => s.dismissed)
  const later = useUpdates((s) => s.later)
  const restart = useUpdates((s) => s.restartAndUpdate)

  const portable = status?.mode === 'portable'
  const visible = !!status?.version && status.version !== dismissed &&
    ((status.mode === 'nsis' && status.state === 'downloaded') || (portable && status.state === 'available'))

  return (
    <AnimatePresence>
      {visible && status && (
        <motion.aside
          role="dialog"
          aria-label={L('Доступно обновление', 'Update available')}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="glass fixed bottom-[104px] right-5 z-[70] w-[360px] overflow-hidden rounded-2xl border border-line shadow-soft"
        >
          <div className="bg-brand h-1" />
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="bg-brand grid size-9 shrink-0 place-items-center rounded-xl text-[#1b1208]"><Sparkles size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-extrabold">{L(`Доступна версия ${status.version}`, `Version ${status.version} is available`)}</h2>
                <p className="text-[12.5px] text-muted">
                  {portable
                    ? L('Портативная версия не обновляется сама — скачай новую.', 'The portable build can’t update itself — download the new one.')
                    : L('Скачано. Музыка продолжит играть с того же места.', 'Downloaded. Music will continue from the same spot.')}
                </p>
              </div>
              <button onClick={later} className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" aria-label={L('Позже', 'Later')}>
                <X size={15} />
              </button>
            </div>

            {status.releaseNotes && (
              <div className="scroll-area mt-3 max-h-36 whitespace-pre-line rounded-xl bg-bg/60 px-3 py-2 text-[12.5px] leading-relaxed text-fg/90">
                {status.releaseNotes}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {portable ? (
                <button onClick={() => void pulse?.updates.openRelease()} className="bg-brand inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-bold text-[#1b1208]">
                  <ExternalLink size={15} /> {L('Скачать новую версию', 'Download new version')}
                </button>
              ) : (
                <button onClick={() => void restart()} className="bg-brand inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-bold text-[#1b1208]">
                  <RotateCw size={15} /> {L('Перезапустить и обновить', 'Restart & update')}
                </button>
              )}
              <button onClick={later} className="h-9 rounded-full bg-elev px-4 text-[13px] font-bold hover:bg-hover">{L('Позже', 'Later')}</button>
            </div>
            {!portable && (
              <p className="mt-2 text-[11px] text-faint">{L('«Позже» — обновление установится при следующем закрытии Pulse.', '“Later” installs it the next time you close Pulse.')}</p>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
