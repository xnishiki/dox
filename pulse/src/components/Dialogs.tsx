import { Check, Copy, ImagePlus, Link2, Lock, Globe, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTr } from '../i18n'
import { cn } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { imageFileToCover, usePlaylists, type Visibility } from '../store/playlists'
import { useUi } from '../store/ui'
import * as remote from '../sync/playlists-remote'
import { syncNow } from '../sync/sync'
import { Button, Field, inputCls, Modal } from './Modal'
import { PlaylistCover } from './PlaylistCover'

// ---------------- Вход / регистрация ----------------
function AuthDialog({ then }: { then?: () => void }) {
  const L = useTr()
  const close = useUi((s) => s.closeDialog)
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-[14px] text-muted">
        {L('Аккаунты пока не настроены. Укажи адрес и ключ проекта Supabase в Настройках — инструкция в README. Без аккаунта всё работает локально.', 'Accounts are not configured. Add your Supabase URL and key in Settings (see README). Without an account everything works locally.')}
      </p>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password)
        close()
        then?.()
      } else {
        const { needsConfirm } = await signUp(email.trim(), password, username.trim())
        if (needsConfirm) setInfo(L('Готово! Подтверди почту по ссылке из письма и войди.', 'Done! Confirm your email and sign in.'))
        else { close(); then?.() }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="mb-4 flex rounded-xl bg-bg p-1">
        {(['in', 'up'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError('') }} className={cn('flex-1 rounded-lg py-2 text-[13.5px] font-bold transition-colors', mode === m ? 'bg-elev text-fg' : 'text-muted')}>
            {m === 'in' ? L('Вход', 'Sign in') : L('Регистрация', 'Sign up')}
          </button>
        ))}
      </div>
      {mode === 'up' && (
        <Field label={L('Имя пользователя', 'Username')} hint={L('Латиница, цифры, _ . — по нему тебя смогут пригласить в плейлист', 'Latin letters, digits, _ . — used for playlist invites')}>
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.\-]{3,24}" autoComplete="username" />
        </Field>
      )}
      <Field label="Email"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
      <Field label={L('Пароль', 'Password')}><input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
      {error && <p className="mb-3 text-[13px] text-[#ff6369]" role="alert">{error}</p>}
      {info && <p className="mb-3 text-[13px] text-mint" role="status">{info}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? '…' : mode === 'in' ? L('Войти', 'Sign in') : L('Создать аккаунт', 'Create account')}</Button>
      <p className="mt-3 text-center text-[12px] text-faint">{L('Никаких подписок — только регистрация.', 'No subscriptions — just sign up.')}</p>
    </form>
  )
}

// ---------------- Создание / редактирование плейлиста ----------------
function PlaylistDialog({ id, tracks }: { id?: string; tracks?: import('../lib/types').Track[] }) {
  const L = useTr()
  const close = useUi((s) => s.closeDialog)
  const showToast = useUi((s) => s.showToast)
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const existing = usePlaylists((s) => (id ? s.get(id) : undefined))
  const { create, update } = usePlaylists()
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [cover, setCover] = useState<string | null>(existing?.cover ?? null)
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'private')
  const [collaborative, setCollaborative] = useState(existing?.collaborative ?? false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickCover = async (file?: File) => {
    if (!file) return
    try { setCover(await imageFileToCover(file)) } catch (err) { showToast((err as Error).message) }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (existing) {
      update(existing.id, { name: name.trim() || existing.name, description: description.trim(), cover, visibility, collaborative })
      close()
    } else {
      const p = create({ name, description: description.trim(), cover, tracks }, user?.id ?? null)
      if (visibility !== 'private' || collaborative) update(p.id, { visibility, collaborative })
      close()
      showToast(tracks?.length ? L('Плейлист создан, трек добавлен', 'Playlist created') : L('Плейлист создан', 'Playlist created'))
      navigate(`/playlist/${p.id}`)
    }
  }

  const visOptions: Array<{ v: Visibility; icon: typeof Lock; ru: string; en: string; hint: [string, string] }> = [
    { v: 'private', icon: Lock, ru: 'Приватный', en: 'Private', hint: ['Видишь только ты и соавторы', 'Only you and collaborators'] },
    { v: 'link', icon: Link2, ru: 'По ссылке', en: 'Link', hint: ['Открывается по ссылке или коду', 'Anyone with the link or code'] },
    { v: 'public', icon: Globe, ru: 'Публичный', en: 'Public', hint: ['Виден всем в поиске', 'Visible to everyone in search'] },
  ]
  const previewTracks = existing?.tracks ?? tracks ?? []

  return (
    <form onSubmit={submit}>
      <div className="mb-4 flex gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="group relative size-36 shrink-0 overflow-hidden rounded-2xl shadow-soft" aria-label={L('Выбрать обложку', 'Choose cover')}>
          <PlaylistCover playlist={{ cover, tracks: previewTracks, name }} rounded="rounded-2xl" />
          <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
            <span className="flex flex-col items-center gap-1 text-[12px] font-bold"><ImagePlus size={24} />{L('Обложка', 'Cover')}</span>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickCover(e.target.files?.[0])} />
        <div className="min-w-0 flex-1">
          <Field label={L('Название', 'Name')}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus placeholder={L('Мой плейлист', 'My playlist')} /></Field>
          {cover && <button type="button" onClick={() => setCover(null)} className="text-[12.5px] font-semibold text-muted hover:text-fg">{L('Убрать свою обложку (будет коллаж)', 'Remove cover (use collage)')}</button>}
        </div>
      </div>
      <Field label={L('Описание', 'Description')}>
        <textarea className={cn(inputCls, 'h-20 resize-none py-2.5')} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </Field>
      <span className="mb-1.5 block text-[12.5px] font-bold text-muted">{L('Видимость', 'Visibility')}</span>
      <div className="mb-3.5 grid grid-cols-3 gap-2">
        {visOptions.map((o) => (
          <button key={o.v} type="button" onClick={() => setVisibility(o.v)} className={cn('rounded-xl border p-2.5 text-left transition-colors', visibility === o.v ? 'border-sun/70 bg-sun/10' : 'border-line hover:bg-hover')}>
            <o.icon size={16} className={visibility === o.v ? 'text-sun' : 'text-muted'} />
            <div className="mt-1 text-[13px] font-bold">{L(o.ru, o.en)}</div>
            <div className="text-[11px] leading-tight text-faint">{L(...o.hint)}</div>
          </button>
        ))}
      </div>
      <label className="mb-5 flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" checked={collaborative} onChange={(e) => setCollaborative(e.target.checked)} className="size-4 accent-[#2EE59D]" />
        <Users size={16} className="text-muted" />
        <span className="text-[13px]"><b>{L('Совместный', 'Collaborative')}</b> — {L('приглашённые тоже могут добавлять треки', 'invited people can add tracks too')}</span>
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>{L('Отмена', 'Cancel')}</Button>
        <Button type="submit">{existing ? L('Сохранить', 'Save') : L('Создать', 'Create')}</Button>
      </div>
    </form>
  )
}

// ---------------- Поделиться ----------------
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[12.5px] font-bold text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex h-11 flex-1 items-center truncate rounded-xl border border-line bg-bg px-3.5 font-mono text-[14px] select-all">{value}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
          className="grid size-11 place-items-center rounded-xl bg-elev text-muted hover:bg-hover hover:text-fg"
          aria-label="Копировать"
        >
          {copied ? <Check size={17} className="text-mint" /> : <Copy size={17} />}
        </button>
      </div>
    </div>
  )
}

function ShareDialog({ id }: { id: string }) {
  const L = useTr()
  const p = usePlaylists((s) => s.get(id))
  const user = useAuth((s) => s.user)
  const update = usePlaylists((s) => s.update)
  const openDialog = useUi((s) => s.openDialog)
  const [members, setMembers] = useState<Array<{ userId: string; username: string }>>([])
  const [invite, setInvite] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadMembers = () => { if (p?.remote && user) remote.listMembers(id).then(setMembers).catch(() => {}) }
  useEffect(loadMembers, [id, p?.remote, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null
  if (!user) {
    return (
      <div>
        <p className="mb-4 text-[14px] text-muted">{L('Чтобы делиться плейлистами и приглашать друзей, войди в аккаунт.', 'Sign in to share playlists and invite friends.')}</p>
        <Button onClick={() => openDialog({ type: 'auth', then: () => openDialog({ type: 'share', id }) })}>{L('Войти', 'Sign in')}</Button>
      </div>
    )
  }
  const isOwner = p.role === 'owner'
  const closed = p.visibility === 'private' && !p.collaborative

  const doInvite = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      await syncNow() // плейлист должен быть на сервере
      await remote.inviteMember(id, invite)
      setMsg({ ok: true, text: L(`${invite} теперь соавтор`, `${invite} is now a collaborator`) })
      setInvite('')
      await syncNow()
      loadMembers()
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message })
    }
  }

  return (
    <div>
      {closed && isOwner ? (
        <div className="mb-4 rounded-xl border border-sun/40 bg-sun/10 p-3 text-[13px]">
          {L('Плейлист приватный: по коду его никто не откроет. Сделай его «по ссылке», публичным или совместным.', 'This playlist is private: nobody can open it by code. Make it link-shared, public or collaborative.')}
          <div className="mt-2 flex gap-2">
            <Button variant="ghost" className="h-8 px-3 text-[12px]" onClick={() => update(id, { visibility: 'link' })}>{L('Сделать «по ссылке»', 'Share by link')}</Button>
            <Button variant="ghost" className="h-8 px-3 text-[12px]" onClick={() => update(id, { collaborative: true })}>{L('Сделать совместным', 'Make collaborative')}</Button>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-[13px] text-muted">
          {p.collaborative
            ? L('Кто введёт код или откроет ссылку, станет соавтором и сможет добавлять треки.', 'Anyone with the code or link becomes a collaborator.')
            : L('Кто введёт код или откроет ссылку, сможет слушать и подписаться на плейлист.', 'Anyone with the code or link can listen and follow.')}
        </p>
      )}
      <CopyRow label={L('Код приглашения', 'Invite code')} value={p.shareCode} />
      <CopyRow label={L('Ссылка-приглашение (откроет Pulse)', 'Invite link (opens Pulse)')} value={`pulse://join/${p.shareCode}`} />

      {isOwner && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2 flex items-center gap-2 text-[14px] font-bold"><UserPlus size={16} /> {L('Пригласить соавтора', 'Invite a collaborator')}</h3>
          <form onSubmit={doInvite} className="flex gap-2">
            <input className={inputCls} value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={L('Имя пользователя', 'Username')} required />
            <Button type="submit">{L('Пригласить', 'Invite')}</Button>
          </form>
          {msg && <p className={cn('mt-2 text-[12.5px]', msg.ok ? 'text-mint' : 'text-[#ff6369]')}>{msg.text}</p>}
          {members.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-hover">
                  <span className="bg-brand grid size-7 place-items-center rounded-full text-[12px] font-bold text-[#1b1208]">{m.username[0]?.toUpperCase()}</span>
                  <span className="flex-1 text-[13.5px] font-semibold">{m.username}</span>
                  <button onClick={() => remote.removeMember(id, m.userId).then(loadMembers)} className="grid size-7 place-items-center rounded-full text-muted hover:text-[#ff6369]" aria-label={L('Убрать', 'Remove')}><X size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------- Вход по коду ----------------
export async function joinWithCode(code: string): Promise<string> {
  const res = await remote.joinByCode(code)
  await syncNow()
  return res.playlistId
}

function JoinDialog({ code: initial }: { code?: string }) {
  const L = useTr()
  const close = useUi((s) => s.closeDialog)
  const openDialog = useUi((s) => s.openDialog)
  const showToast = useUi((s) => s.showToast)
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  const [code, setCode] = useState(initial ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!user) return openDialog({ type: 'auth', then: () => openDialog({ type: 'join', code }) })
    setBusy(true); setError('')
    try {
      const id = await joinWithCode(code)
      close()
      showToast(L('Плейлист добавлен в медиатеку', 'Playlist added to your library'))
      navigate(`/playlist/${id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="mb-4 text-[13.5px] text-muted">{L('Введи код, которым с тобой поделились, например PULSE-7F3K.', 'Enter the code someone shared with you, e.g. PULSE-7F3K.')}</p>
      <input
        className={cn(inputCls, 'h-14 text-center font-mono text-[22px] font-bold uppercase tracking-[0.2em]')}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="PULSE-XXXX"
        maxLength={10}
        autoFocus
        required
        pattern="PULSE-[A-Za-z0-9]{4}"
      />
      {error && <p className="mt-2 text-[13px] text-[#ff6369]" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="mt-4 w-full">{busy ? '…' : user ? L('Открыть плейлист', 'Open playlist') : L('Войти и открыть', 'Sign in & open')}</Button>
    </form>
  )
}

export function Dialogs() {
  const L = useTr()
  const dialog = useUi((s) => s.dialog)
  const close = useUi((s) => s.closeDialog)
  const titles = {
    auth: L('Аккаунт Pulse', 'Pulse account'),
    playlist: dialog?.type === 'playlist' && dialog.id ? L('Редактировать плейлист', 'Edit playlist') : L('Новый плейлист', 'New playlist'),
    share: L('Поделиться плейлистом', 'Share playlist'),
    join: L('Плейлист по коду', 'Join by code'),
  }
  return (
    <Modal open={!!dialog} onClose={close} title={dialog ? titles[dialog.type] : ''} width={dialog?.type === 'playlist' ? 560 : 460}>
      {dialog?.type === 'auth' && <AuthDialog then={dialog.then} />}
      {dialog?.type === 'playlist' && <PlaylistDialog key={dialog.id ?? 'new'} id={dialog.id} tracks={dialog.tracks} />}
      {dialog?.type === 'share' && <ShareDialog id={dialog.id} />}
      {dialog?.type === 'join' && <JoinDialog code={dialog.code} />}
    </Modal>
  )
}

