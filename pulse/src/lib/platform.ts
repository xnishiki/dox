/** Обёртка над мостом Electron: в браузерном режиме разработки все вызовы безопасно ничего не делают */
export const isElectron = typeof window !== 'undefined' && !!window.pulse
export const pulse = typeof window !== 'undefined' ? window.pulse : undefined
