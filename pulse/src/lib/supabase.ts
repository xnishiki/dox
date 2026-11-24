import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useSettings } from '../store/settings'

const ENV_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

let client: SupabaseClient | null = null
let clientFor = ''

function config() {
  const s = useSettings.getState()
  return { url: (s.supabaseUrl || ENV_URL).trim(), key: (s.supabaseAnonKey || ENV_KEY).trim() }
}

export const hasEnvSupabase = () => !!(ENV_URL && ENV_KEY)
export const isSupabaseConfigured = () => {
  const { url, key } = config()
  return /^https:\/\/.+/.test(url) && key.length > 20
}

/** Клиент Supabase или null, если аккаунты не настроены (тогда всё работает локально) */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  const { url, key } = config()
  if (!client || clientFor !== url + key) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'pulse.auth' },
    })
    clientFor = url + key
  }
  return client
}

/** Человекочитаемое сообщение из ошибки Supabase */
export function errorText(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err)
  if (/Invalid login credentials/i.test(msg)) return 'Неверная почта или пароль'
  if (/User already registered/i.test(msg)) return 'Такая почта уже зарегистрирована'
  if (/Email not confirmed/i.test(msg)) return 'Подтвердите почту по ссылке из письма'
  if (/Password should be at least/i.test(msg)) return 'Пароль должен быть не короче 6 символов'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Нет связи с сервером'
  return msg
}
