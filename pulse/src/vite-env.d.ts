/// <reference types="vite/client" />
import type { PulseApi } from '../electron/preload'

interface ImportMetaEnv {
  readonly VITE_JAMENDO_CLIENT_ID?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

declare global {
  interface Window {
    /** Есть только внутри Electron; в браузерном режиме разработки — undefined */
    pulse?: PulseApi
  }
}

export {}
