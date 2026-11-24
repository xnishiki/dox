import { Construction } from 'lucide-react'
import { Page } from '../components/ui'
import { useT, type TKey } from '../i18n'

/** Временная страница для разделов следующих этапов */
export default function Placeholder({ titleKey, stage }: { titleKey: TKey; stage: number }) {
  const t = useT()
  return (
    <Page>
      <h1 className="mb-6 text-[32px] font-extrabold tracking-tight">{t(titleKey)}</h1>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <Construction size={30} className="text-sun" />
        <p className="text-[15px] font-semibold">Этап {stage}</p>
        <p className="max-w-sm text-[13.5px] text-muted">{t('state.soon')}</p>
      </div>
    </Page>
  )
}
