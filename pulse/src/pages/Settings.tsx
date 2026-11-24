import { Check, ExternalLink, FolderOpen } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, inputCls } from '../components/Modal'
import { UpdatesSettings } from '../components/UpdatesSettings'
import { Page, Segmented } from '../components/ui'
import { useTr } from '../i18n'
import { hasEnvJamendoKey, hasJamendoKey, setJamendoClientId } from '../lib/jamendo'
import { isElectron } from '../lib/platform'
import { hasEnvSupabase, isSupabaseConfigured } from '../lib/supabase'
import { initAuth, useAuth } from '../store/auth'
import { useLocal } from '../store/local'
import { useSettings } from '../store/settings'
import { useUi } from '../store/ui'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-[13px] font-bold uppercase tracking-[0.14em] text-faint">{title}</h2>
      <div className="rounded-2xl bg-surface px-5">{children}</div>
    </section>
  )
}

function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-4 last:border-0">
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold">{title}</div>
        {hint && <div className="text-[12.5px] text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Status({ ok, okText, noText }: { ok: boolean; okText: string; noText: string }) {
  return <span className={ok ? 'inline-flex items-center gap-1 text-[12.5px] font-bold text-mint' : 'text-[12.5px] font-bold text-ember'}>{ok && <Check size={14} />}{ok ? okText : noText}</span>
}

function KeysForm() {
  const L = useTr()
  const s = useSettings()
  const showToast = useUi((x) => x.showToast)
  const [jamendo, setJamendo] = useState(s.jamendoClientId)
  const [url, setUrl] = useState(s.supabaseUrl)
  const [key, setKey] = useState(s.supabaseAnonKey)
  const save = () => {
    s.set({ jamendoClientId: jamendo.trim(), supabaseUrl: url.trim(), supabaseAnonKey: key.trim() })
    setJamendoClientId(jamendo)
    initAuth()
    showToast(L('Ключи сохранены', 'Keys saved'))
  }
  return (
    <div className="py-4">
      <p className="mb-3 text-[12.5px] text-muted">
        {L('Если приложение собрано без ключей в .env, их можно вписать здесь. Как получить — в README.', 'If the app was built without keys in .env, enter them here. See README.')}
      </p>
      <label className="mb-3 block">
        <span className="mb-1 flex items-center justify-between text-[12.5px] font-bold text-muted">
          Jamendo client_id <Status ok={hasJamendoKey()} okText={hasEnvJamendoKey() && !s.jamendoClientId ? L('из сборки', 'from build') : L('задан', 'set')} noText={L('не задан', 'missing')} />
        </span>
        <input className={inputCls} value={jamendo} onChange={(e) => setJamendo(e.target.value)} placeholder={hasEnvJamendoKey() ? L('используется ключ из сборки', 'using the built-in key') : 'a1b2c3d4'} spellCheck={false} />
      </label>
      <label className="mb-3 block">
        <span className="mb-1 flex items-center justify-between text-[12.5px] font-bold text-muted">
          Supabase URL <Status ok={isSupabaseConfigured()} okText={hasEnvSupabase() && !s.supabaseUrl ? L('из сборки', 'from build') : L('задан', 'set')} noText={L('не задан', 'missing')} />
        </span>
        <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" spellCheck={false} />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-[12.5px] font-bold text-muted">Supabase anon key</span>
        <input className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" spellCheck={false} type="password" />
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={save}>{L('Сохранить ключи', 'Save keys')}</Button>
        <a href="https://devportal.jamendo.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-fg">devportal.jamendo.com <ExternalLink size={12} /></a>
      </div>
    </div>
  )
}

export default function Settings() {
  const L = useTr()
  const s = useSettings()
  const user = useAuth((x) => x.user)
  const signOut = useAuth((x) => x.signOut)
  const openDialog = useUi((x) => x.openDialog)
  const local = useLocal()
  const location = useLocation()
  // Переход из значка обновления: сразу к разделу «Обновления»
  useEffect(() => {
    if (location.hash === '#updates') setTimeout(() => document.getElementById('updates')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
  }, [location.hash])

  const keys: Array<[string, string]> = [
    [L('Пробел', 'Space'), L('Пауза / играть', 'Play / pause')],
    ['← / →', L('Перемотка на 5 секунд', 'Seek 5 seconds')],
    ['↑ / ↓', L('Громкость', 'Volume')],
    ['Ctrl + F', L('Поиск', 'Search')],
    ['Esc', L('Закрыть «Сейчас играет» и меню', 'Close Now Playing & menus')],
    [L('Медиаклавиши', 'Media keys'), L('Играть, пауза, следующий, предыдущий', 'Play, pause, next, previous')],
  ]

  return (
    <Page className="max-w-[860px]">
      <h1 className="mb-6 text-[32px] font-extrabold tracking-tight">{L('Настройки', 'Settings')}</h1>

      <Section title={L('Аккаунт', 'Account')}>
        <Row title={user ? user.username : L('Не выполнен вход', 'Not signed in')} hint={user ? user.email : L('Аккаунт нужен для синхронизации и совместных плейлистов. Без него всё работает локально.', 'Needed for sync and shared playlists. Everything works locally without it.')}>
          {user ? <Button variant="ghost" onClick={() => void signOut()}>{L('Выйти', 'Sign out')}</Button> : <Button onClick={() => openDialog({ type: 'auth' })}>{L('Войти', 'Sign in')}</Button>}
        </Row>
      </Section>

      <Section title={L('Внешний вид', 'Appearance')}>
        <Row title={L('Тема', 'Theme')}>
          <Segmented value={s.theme} onChange={(theme) => s.set({ theme })} options={[{ value: 'dark', label: L('Тёмная', 'Dark') }, { value: 'light', label: L('Светлая', 'Light') }]} />
        </Row>
        <Row title={L('Язык', 'Language')}>
          <Segmented value={s.lang} onChange={(lang) => s.set({ lang })} options={[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]} />
        </Row>
      </Section>

      <Section title={L('Воспроизведение', 'Playback')}>
        <Row title={L('Качество потока', 'Streaming quality')} hint={L('Применяется к новым загруженным трекам', 'Applies to newly loaded tracks')}>
          <Segmented value={s.quality} onChange={(quality) => s.set({ quality })} options={[{ value: 'mp31', label: L('Экономное · 96 кбит/с', 'Data saver · 96 kbps') }, { value: 'mp32', label: L('Высокое', 'High') }]} />
        </Row>
        <Row title={L('Папка локальной музыки', 'Local music folder')} hint={local.folder ?? L('Не выбрана', 'Not selected')}>
          {isElectron ? (
            <div className="flex gap-2">
              {local.folder && <Button variant="ghost" onClick={() => void local.forget()}>{L('Забыть', 'Forget')}</Button>}
              <Button variant="ghost" onClick={() => void local.pickFolder()}><FolderOpen size={16} /> {L('Выбрать', 'Choose')}</Button>
            </div>
          ) : <span className="text-[12.5px] text-muted">{L('Только в приложении', 'Desktop app only')}</span>}
        </Row>
      </Section>

      <Section title={L('Обновления', 'Updates')}>
        <UpdatesSettings />
      </Section>

      <Section title={L('Ключи сервисов', 'Service keys')}>
        <KeysForm />
      </Section>

      <Section title={L('Горячие клавиши', 'Keyboard shortcuts')}>
        {keys.map(([k, v]) => (
          <Row key={k} title={v}><kbd className="rounded-lg border border-line bg-bg px-2.5 py-1 font-sans text-[12.5px] font-bold text-muted">{k}</kbd></Row>
        ))}
      </Section>

      <p className="text-center text-[12px] text-faint">
        Pulse · {L('музыка — Jamendo (лицензии Creative Commons)', 'music by Jamendo (Creative Commons)')}
      </p>
    </Page>
  )
}
