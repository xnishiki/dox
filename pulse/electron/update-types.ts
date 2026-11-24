/** Общие типы обновлений для главного процесса, preload и интерфейса */

export type UpdateChannel = 'stable' | 'beta'

/**
 * nsis — установленная версия, обновляется сама;
 * portable — только сообщаем о новой версии и даём ссылку;
 * dev — режим разработки, обновления выключены (кроме проверки через dev-app-update.yml).
 */
export type UpdateMode = 'nsis' | 'portable' | 'dev'

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateSettings {
  auto: boolean
  channel: UpdateChannel
}

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdateStatus {
  mode: UpdateMode
  state: UpdateState
  currentVersion: string
  settings: UpdateSettings
  /** Найденная новая версия */
  version?: string
  /** Список изменений обычным текстом (из описания релиза на GitHub) */
  releaseNotes?: string
  /** Страница релиза — для portable-версии */
  releaseUrl?: string
  progress?: UpdateProgress
  /** Когда последний раз успешно проверяли (мс) */
  lastCheck?: number
  /** Ошибка показывается только после ручной проверки */
  error?: string
  /** Пользователь нажал «Позже» — поставим при закрытии */
  installOnQuit?: boolean
}
