import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useUi } from '../store/ui'

export function Toast() {
  const toast = useUi((s) => s.toast)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => useUi.setState({ toast: null }), 2400)
    return () => clearTimeout(id)
  }, [toast])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[104px] z-[90] flex justify-center" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="rounded-xl bg-fg px-4 py-2.5 text-[13.5px] font-semibold text-bg shadow-soft"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
