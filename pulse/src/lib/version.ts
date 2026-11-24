import { version } from '../../package.json'

/** Версия приложения берётся из package.json */
export const APP_VERSION: string = version

const LAST_KEY = 'pulse.lastSeenVersion'

/**
 * true — приложение только что обновилось (нужно один раз показать «Что нового»).
 * При первой установке ничего не показываем, просто запоминаем версию.
 */
export function takeJustUpdated(): boolean {
  try {
    const last = localStorage.getItem(LAST_KEY)
    localStorage.setItem(LAST_KEY, APP_VERSION)
    return !!last && last !== APP_VERSION
  } catch {
    return false
  }
}
