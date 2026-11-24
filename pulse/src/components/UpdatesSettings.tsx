import { ArrowDownToLine, FileText, RefreshCw, RotateCw, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTr } from '../i18n'
import { pulse } from '../lib/platform'
import { APP_VERSION } from '../lib/version'
import { useSettings } from '../store/settings'
import { useUpdates } from '../store/updates'
import { Button } from './Modal'
import { Segmented } from './ui'

const mb = (n: number) => (n / 1048576).toFixed(1).replace('.', ',')

/** Раздел «Обновления» в настройках */
export function UpdatesSettings() {
  const L = useTr()
  const lang = useSettings((s) => s.lang)
  const status = useUpdates((s) => s.status)
  const restart = useUpdates((s) => s.restartAndUpdate)
  const row = 'flex items-center justify-between gap-6 border-b border-line py-4 last:border-0'

  if (!pulse || !status) {
    return (
      <div className={row}>
        <div>
          <div className="text-[14.5px] font-semibold">{L('Текущая версия', 'Current version')}: {APP_VERSION}</div>
          <div className="text-[12.5px] text-muted">{L('Обновления работают в установленном приложении для Windows.', 'Updates work in the installed Windows app.')}</div>
        </div>
      </div>
    )
  }

  const busy = status.state === 'checking' || status.state === 'downloading'
  const lastCheck = status.lastCheck
    ? new Date(status.lastCheck).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : L('ещё не проверяли', 'never')

  const stateText = (() => {
    switch (status.state) {
      case 'checking': return L('Проверяю…', 'Checking…')
      case 'not-available': return L('Установлена последняя версия', 'You’re up to date')
      case 'available': return status.mode === 'portable'
        ? L(`Доступна версия ${status.version} — скачай её со страницы релиза`, `Version ${status.version} is available — download it from the release page`)
        : L(`Доступна версия ${status.version}`, `Version ${status.version} is available`)
      case 'downloading': return L(`Загружается версия ${status.version ?? ''}`, `Downloading ${status.version ?? ''}`)
      case 'downloaded': return L(`Версия ${status.version} готова к установке`, `Version ${status.version} is ready to install`)
      case 'error': return status.error ?? L('Не удалось проверить', 'Check failed')
      default: return status.mode === 'dev' ? L('Режим разработки: обновления выключены', 'Dev mode: updates are off') : ''
    }
  })()

  const pct = status.progress?.percent ?? 0

  return (
    <div id="updates">
      <div className={row}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14.5px] font-semibold">
            {L('Текущая версия', 'Current version')}: <span className="tabular-nums">{status.currentVersion}</span>
            {status.mode === 'portable' && <span className="rounded-full bg-elev px-2 py-0.5 text-[11px] font-bold text-muted">portable</span>}
          </div>
          <div className={status.state === 'error' ? 'text-[12.5px] text-ember' : 'text-[12.5px] text-muted'} role="status" aria-live="polite">
            {stateText || L(`Последняя проверка: ${lastCheck}`, `Last checked: ${lastCheck}`)}
          </div>
          {stateText && status.state !== 'checking' && <div className="text-[12px] text-faint">{L(`Последняя проверка: ${lastCheck}`, `Last checked: ${lastCheck}`)}</div>}
        </div>
        <div className="flex shrink-0 gap-2">
          {status.state === 'downloaded' && status.mode === 'nsis' ? (
            <Button onClick={() => void restart()}><RotateCw size={15} /> {L('Перезапустить и обновить', 'Restart & update')}</Button>
          ) : status.state === 'available' && status.mode === 'portable' ? (
            <Button onClick={() => void pulse?.updates.openRelease()}><ArrowDownToLine size={15} /> {L('Скачать', 'Download')}</Button>
          ) : status.state === 'available' && status.mode === 'nsis' && !status.settings.auto ? (
            <Button onClick={() => void pulse?.updates.download()}><ArrowDownToLine size={15} /> {L('Скачать', 'Download')}</Button>
          ) : (
            <Button variant="ghost" disabled={busy || status.mode === 'dev'} onClick={() => void pulse?.updates.check()}>
              <RefreshCw size={15} className={status.state === 'checking' ? 'animate-spin' : ''} /> {L('Проверить сейчас', 'Check now')}
            </Button>
          )}
        </div>
      </div>

      {status.state === 'downloading' && (
        <div className="border-b border-line py-4">
          <div className="mb-2 flex justify-between text-[12.5px] tabular-nums text-muted">
            <span>{Math.round(pct)}%{status.progress?.total ? ` · ${mb(status.progress.transferred)} ${L('из', 'of')} ${mb(status.progress.total)} ${L('МБ', 'MB')}` : ''}</span>
            <span>{status.progress?.bytesPerSecond ? `${mb(status.progress.bytesPerSecond)} ${L('МБ/с', 'MB/s')}` : ''}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="bg-brand h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%` } as CSSProperties} />
          </div>
          <p className="mt-2 text-[12px] text-faint">{L('Скачивается только изменившаяся часть. Музыка играет как обычно.', 'Only the changed part is downloaded. Music keeps playing.')}</p>
        </div>
      )}

      <div className={row}>
        <div>
          <div className="text-[14.5px] font-semibold">{L('Обновлять автоматически', 'Update automatically')}</div>
          <div className="text-[12.5px] text-muted">
            {status.mode === 'portable'
              ? L('Портативная версия только сообщает о новых версиях.', 'The portable build only tells you about new versions.')
              : L('Скачивать новые версии в фоне. Без этого — только уведомление.', 'Download new versions in the background. Otherwise just notify.')}
          </div>
        </div>
        <button
          role="switch"
          aria-checked={status.settings.auto}
          aria-label={L('Обновлять автоматически', 'Update automatically')}
          disabled={status.mode !== 'nsis'}
          onClick={() => void pulse?.updates.setSettings({ auto: !status.settings.auto })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${status.settings.auto && status.mode === 'nsis' ? 'bg-mint' : 'bg-hover'}`}
        >
          <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]" style={{ left: status.settings.auto && status.mode === 'nsis' ? 22 : 2 }} />
        </button>
      </div>

      <div className={row}>
        <div>
          <div className="text-[14.5px] font-semibold">{L('Канал обновлений', 'Update channel')}</div>
          <div className="text-[12.5px] text-muted">{L('Бета — пробные версии раньше всех (могут быть ошибки).', 'Beta — try new versions early (may have bugs).')}</div>
        </div>
        <Segmented
          value={status.settings.channel}
          onChange={(channel) => void pulse?.updates.setSettings({ channel })}
          options={[{ value: 'stable', label: L('Стабильный', 'Stable') }, { value: 'beta', label: L('Бета', 'Beta') }]}
        />
      </div>

      <div className="flex flex-wrap gap-4 py-4 text-[13px] font-semibold">
        <Link to="/whats-new" className="inline-flex items-center gap-1.5 text-muted hover:text-fg"><Sparkles size={15} /> {L('Что нового', 'What’s new')}</Link>
        <button onClick={() => void pulse?.updates.openLogs()} className="inline-flex items-center gap-1.5 text-muted hover:text-fg"><FileText size={15} /> {L('Открыть логи', 'Open logs')}</button>
      </div>
    </div>
  )
}
