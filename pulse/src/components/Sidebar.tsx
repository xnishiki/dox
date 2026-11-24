import { motion } from 'framer-motion'
import { AudioWaveform, CloudOff, House, KeyRound, LayoutGrid, Library, LogIn, LogOut, Plus, RefreshCw, Search, Settings, Users } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useT, useTr, type TKey } from '../i18n'
import { cn } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { usePlaylists } from '../store/playlists'
import { useUi } from '../store/ui'
import { syncNow, useSync } from '../sync/sync'
import { PlaylistCover } from './PlaylistCover'

const items: Array<{ to: string; key: TKey; icon: typeof House }> = [
  { to: '/', key: 'nav.home', icon: House },
  { to: '/search', key: 'nav.search', icon: Search },
  { to: '/flow', key: 'nav.flow', icon: AudioWaveform },
  { to: '/categories', key: 'nav.categories', icon: LayoutGrid },
  { to: '/library', key: 'nav.library', icon: Library },
]

const isActive = (pathname: string, to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

function AccountBox() {
  const L = useTr()
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const openDialog = useUi((s) => s.openDialog)
  const { online, syncing, error } = useSync()
  if (!user) {
    return (
      <button onClick={() => openDialog({ type: 'auth' })} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold text-muted hover:bg-elev hover:text-fg">
        <LogIn size={18} /> {isSupabaseConfigured() ? L('Войти / регистрация', 'Sign in / up') : L('Аккаунт', 'Account')}
      </button>
    )
  }
  const status = !online ? L('Нет сети — изменения сохранятся', 'Offline — changes are saved') : syncing ? L('Синхронизация…', 'Syncing…') : error ? L('Ошибка синхронизации', 'Sync error') : L('Синхронизировано', 'Synced')
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
      <span className="bg-brand grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-[#1b1208]">{user.username[0]?.toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">{user.username}</div>
        <button onClick={() => void syncNow()} className={cn('flex items-center gap-1 text-[11px]', error ? 'text-[#ff6369]' : 'text-faint hover:text-muted')} title={error ?? undefined}>
          {!online ? <CloudOff size={11} /> : <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />}
          <span className="truncate">{status}</span>
        </button>
      </div>
      <button onClick={() => { if (confirm(L('Выйти из аккаунта?', 'Sign out?'))) void signOut() }} className="grid size-8 place-items-center rounded-full text-muted hover:bg-elev hover:text-fg" aria-label={L('Выйти', 'Sign out')} title={L('Выйти', 'Sign out')}>
        <LogOut size={16} />
      </button>
    </div>
  )
}

export function Sidebar() {
  const t = useT()
  const L = useTr()
  const { pathname } = useLocation()
  const all = usePlaylists((s) => s.playlists)
  const openDialog = useUi((s) => s.openDialog)
  const playlists = all.filter((p) => !p.deleted)

  const link = (to: string, label: string, Icon: typeof House) => {
    const active = isActive(pathname, to)
    return (
      <NavLink key={to} to={to} className={cn('relative flex h-10 items-center gap-3.5 rounded-xl px-3 text-[14px] font-semibold transition-colors', active ? 'text-fg' : 'text-muted hover:text-fg')}>
        {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-elev" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        <Icon size={20} className={cn('relative', active && 'text-sun')} strokeWidth={active ? 2.4 : 2} />
        <span className="relative truncate">{label}</span>
      </NavLink>
    )
  }

  return (
    <aside className="flex w-[232px] shrink-0 flex-col gap-1 border-r border-line bg-bg-2 px-3 pb-2 pt-2 max-[1050px]:w-[212px]">
      <nav className="flex flex-col gap-0.5">{items.map((i) => link(i.to, t(i.key), i.icon))}</nav>

      <div className="mt-5 flex items-center justify-between pl-3 pr-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{t('nav.playlists')}</span>
        <div className="flex">
          <button className="grid size-7 place-items-center rounded-full text-muted hover:bg-elev hover:text-fg" onClick={() => openDialog({ type: 'join' })} aria-label={L('Плейлист по коду', 'Join by code')} title={L('Плейлист по коду', 'Join by code')}>
            <KeyRound size={15} />
          </button>
          <button className="grid size-7 place-items-center rounded-full text-muted hover:bg-elev hover:text-fg" onClick={() => openDialog({ type: 'playlist' })} aria-label={L('Новый плейлист', 'New playlist')} title={L('Новый плейлист', 'New playlist')}>
            <Plus size={17} />
          </button>
        </div>
      </div>
      <div className="scroll-area -mx-1 mt-1 flex-1 px-1">
        {playlists.length === 0 ? (
          <button onClick={() => openDialog({ type: 'playlist' })} className="w-full rounded-xl border border-dashed border-line px-3 py-3 text-left text-[12.5px] text-faint hover:text-muted">
            {L('Создай свой первый плейлист', 'Create your first playlist')}
          </button>
        ) : (
          playlists.map((p) => {
            const active = pathname === `/playlist/${p.id}`
            return (
              <NavLink key={p.id} to={`/playlist/${p.id}`} className={cn('flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors', active ? 'bg-elev' : 'hover:bg-surface')}>
                <span className="size-9 shrink-0 overflow-hidden rounded-md"><PlaylistCover playlist={p} rounded="rounded-md" /></span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] font-semibold', active && 'text-sun')}>{p.name}</span>
                  <span className="flex items-center gap-1 truncate text-[11.5px] text-faint">
                    {p.collaborative && <Users size={11} />}
                    {p.role === 'follower' ? p.ownerName : `${p.tracks.length} ${L('тр.', 'tr.')}`}
                  </span>
                </span>
              </NavLink>
            )
          })
        )}
      </div>

      <div className="border-t border-line pt-1.5">
        <AccountBox />
        {link('/settings', t('nav.settings'), Settings)}
      </div>
    </aside>
  )
}
