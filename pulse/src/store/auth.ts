import { create } from 'zustand'
import { errorText, getSupabase } from '../lib/supabase'

export interface AuthUser {
  id: string
  email: string
  username: string
}

interface AuthState {
  user: AuthUser | null
  ready: boolean
  signUp: (email: string, password: string, username: string) => Promise<{ needsConfirm: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

async function loadProfile(id: string, email: string): Promise<AuthUser> {
  const sb = getSupabase()!
  const { data } = await sb.from('profiles').select('username').eq('id', id).maybeSingle()
  return { id, email, username: data?.username ?? email.split('@')[0] }
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,

  signUp: async (email, password, username) => {
    const sb = getSupabase()
    if (!sb) throw new Error('Аккаунты не настроены (Supabase)')
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) throw new Error('Имя: 3–24 символа, латиница, цифры, _ . -')
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } })
    if (error) throw new Error(errorText(error))
    return { needsConfirm: !data.session }
  },

  signIn: async (email, password) => {
    const sb = getSupabase()
    if (!sb) throw new Error('Аккаунты не настроены (Supabase)')
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(errorText(error))
  },

  signOut: async () => {
    await getSupabase()?.auth.signOut()
    set({ user: null })
  },
}))

let unsubscribe: (() => void) | null = null

/** Подписка на изменения сессии. Повторный вызов (после смены ключей) переподключается. */
export function initAuth() {
  unsubscribe?.()
  unsubscribe = null
  const sb = getSupabase()
  if (!sb) {
    useAuth.setState({ user: null, ready: true })
    return
  }
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    if (!session?.user) {
      useAuth.setState({ user: null, ready: true })
      return
    }
    if (event === 'TOKEN_REFRESHED' && useAuth.getState().user?.id === session.user.id) return
    // Профиль грузим вне колбэка: внутри него нельзя ждать других запросов Supabase
    const { id, email = '' } = session.user
    setTimeout(() => {
      loadProfile(id, email)
        .then((user) => useAuth.setState({ user, ready: true }))
        .catch(() => useAuth.setState({ user: { id, email, username: email.split('@')[0] }, ready: true }))
    }, 0)
  })
  unsubscribe = () => data.subscription.unsubscribe()
}
