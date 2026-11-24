import { app, ipcMain, net, shell, type BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import fs from 'node:fs'
import path from 'node:path'
import pkg from '../package.json'
import type { UpdateChannel, UpdateMode, UpdateSettings, UpdateStatus } from './update-types'

/**
 * Автообновление через GitHub Releases (electron-updater).
 * - Установленная (NSIS) версия: тихо проверяет при запуске и каждые 4 часа,
 *   скачивает в фоне (дифференциально, по .blockmap), ставит по кнопке или при выходе.
 * - Portable: только проверяет и показывает ссылку на новую версию.
 * - Без сети / GitHub недоступен: проверка тихо пропускается, ошибка — только в логе.
 */

const CHECK_INTERVAL = 4 * 60 * 60 * 1000
const FIRST_CHECK_DELAY = 8_000
const publish = (pkg.build.publish as Array<{ owner: string; repo: string }>)[0]
const RELEASES_URL = `https://github.com/${publish.owner}/${publish.repo}/releases`

log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = isDevEnv() ? 'debug' : false

function isDevEnv() {
  return !app.isPackaged
}

function detectMode(): UpdateMode {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return 'portable'
  if (!app.isPackaged) return process.env.PULSE_DEV_UPDATE ? 'nsis' : 'dev'
  return 'nsis'
}

// ---------- настройки (хранятся рядом с данными приложения) ----------
const settingsFile = () => path.join(app.getPath('userData'), 'update-settings.json')
function loadSettings(): UpdateSettings {
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))
    return { auto: s.auto !== false, channel: s.channel === 'beta' ? 'beta' : 'stable' }
  } catch {
    return { auto: true, channel: 'stable' }
  }
}
function saveSettings(s: UpdateSettings) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(s)) } catch (err) { log.warn('Не удалось сохранить настройки обновлений', err) }
}

// ---------- список изменений: HTML из GitHub → обычный текст ----------
function notesToText(notes: UpdateInfo['releaseNotes']): string | undefined {
  if (!notes) return undefined
  const html = typeof notes === 'string' ? notes : notes.map((n) => `<h3>${n.version}</h3>${n.note ?? ''}`).join('\n')
  const text = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/(p|h[1-6]|ul|ol|li|div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.slice(0, 4000) || undefined
}

let status: UpdateStatus
let getWindow: () => BrowserWindow | null = () => null
let beforeInstall: () => void = () => {}
let manualCheck = false
let lastProgressSent = 0

function send() {
  getWindow()?.webContents.send('update:status', status)
}
function patch(p: Partial<UpdateStatus>) {
  status = { ...status, ...p }
  send()
}

function applySettings() {
  const { auto, channel } = status.settings
  const updatable = status.mode === 'nsis'
  autoUpdater.autoDownload = updatable && auto
  autoUpdater.autoInstallOnAppQuit = updatable
  // Бета: смотрим и pre-release на GitHub (теги вида v1.2.0-beta.1)
  autoUpdater.channel = channel === 'beta' ? 'beta' : 'latest'
  autoUpdater.allowPrerelease = channel === 'beta'
  // Установка channel включает откат версий — нам он не нужен
  autoUpdater.allowDowngrade = false
}

export async function checkForUpdates(manual = false) {
  if (status.mode === 'dev') {
    if (manual) patch({ state: 'error', error: 'В режиме разработки обновления выключены (см. README: dev-app-update.yml)' })
    return
  }
  if (['checking', 'downloading', 'downloaded'].includes(status.state)) {
    // Уже скачано — повторная проверка не нужна; идёт загрузка — не мешаем
    if (manual) send()
    return
  }
  if (!net.isOnline()) {
    log.info('Проверка обновлений пропущена: нет сети')
    if (manual) patch({ state: 'error', error: 'Нет подключения к интернету' })
    return
  }
  manualCheck = manual
  patch({ state: 'checking', error: undefined })
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    // Событие 'error' уже обработано ниже; здесь просто не даём исключению всплыть
    log.warn('Проверка обновлений не удалась', (err as Error)?.message)
  }
}

export function initUpdater(opts: { getWindow: () => BrowserWindow | null; beforeInstall: () => void }) {
  getWindow = opts.getWindow
  beforeInstall = opts.beforeInstall
  const mode = detectMode()
  status = { mode, state: 'idle', currentVersion: app.getVersion(), settings: loadSettings() }

  autoUpdater.logger = log
  if (mode === 'nsis' && !app.isPackaged) autoUpdater.forceDevUpdateConfig = true
  applySettings()
  log.info(`Pulse ${status.currentVersion}, режим обновлений: ${mode}, канал: ${status.settings.channel}`)

  autoUpdater.on('update-available', (info) => {
    const releaseUrl = `${RELEASES_URL}/tag/v${info.version}`
    patch({
      state: status.mode === 'nsis' && status.settings.auto ? 'downloading' : 'available',
      version: info.version,
      releaseNotes: notesToText(info.releaseNotes),
      releaseUrl,
      lastCheck: Date.now(),
      progress: status.mode === 'nsis' && status.settings.auto ? { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 } : undefined,
    })
  })

  autoUpdater.on('update-not-available', () => {
    patch({ state: 'not-available', lastCheck: Date.now(), version: undefined, releaseNotes: undefined, progress: undefined })
  })

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    status = { ...status, state: 'downloading', progress: { percent: p.percent, bytesPerSecond: p.bytesPerSecond, transferred: p.transferred, total: p.total } }
    // Не чаще 2 раз в секунду
    const now = Date.now()
    if (now - lastProgressSent > 500) { lastProgressSent = now; send() }
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`Обновление ${info.version} скачано`)
    patch({ state: 'downloaded', version: info.version, releaseNotes: notesToText(info.releaseNotes) ?? status.releaseNotes, lastCheck: Date.now(), progress: undefined })
  })

  autoUpdater.on('error', (err) => {
    log.warn('Ошибка обновления:', err?.message ?? err)
    // Без сети или при недоступном GitHub — тихо; текст ошибки показываем только после ручной проверки.
    // Прерванная загрузка продолжится при следующей проверке (electron-updater хранит кэш в pending).
    const wasDownloading = status.state === 'downloading'
    patch({
      state: manualCheck ? 'error' : wasDownloading ? 'available' : 'idle',
      error: manualCheck ? humanError(err) : undefined,
      progress: undefined,
    })
    manualCheck = false
  })

  autoUpdater.on('update-not-available', () => { manualCheck = false })
  autoUpdater.on('update-available', () => { manualCheck = false })

  // ---------- IPC ----------
  ipcMain.handle('update:getStatus', () => status)
  ipcMain.handle('update:check', () => checkForUpdates(true))
  ipcMain.handle('update:download', async () => {
    if (status.mode !== 'nsis' || status.state !== 'available') return
    patch({ state: 'downloading', progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 } })
    try { await autoUpdater.downloadUpdate() } catch (err) { log.warn('Загрузка не удалась', (err as Error)?.message) }
  })
  ipcMain.handle('update:later', () => {
    // Поставится при следующем выходе из приложения (autoInstallOnAppQuit)
    patch({ installOnQuit: true })
  })
  ipcMain.handle('update:install', () => {
    if (status.state !== 'downloaded') return
    log.info(`Перезапуск для установки ${status.version}`)
    beforeInstall()
    // isSilent = true: без окон установщика; isForceRunAfter = true: сразу запустить новую версию
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
  })
  ipcMain.handle('update:setSettings', (_e, s: Partial<UpdateSettings>) => {
    const next: UpdateSettings = {
      auto: typeof s.auto === 'boolean' ? s.auto : status.settings.auto,
      channel: (s.channel === 'beta' || s.channel === 'stable' ? s.channel : status.settings.channel) as UpdateChannel,
    }
    const channelChanged = next.channel !== status.settings.channel
    saveSettings(next)
    patch({ settings: next })
    applySettings()
    if (channelChanged && status.state !== 'downloaded' && status.state !== 'downloading') {
      patch({ state: 'idle', version: undefined, releaseNotes: undefined })
      void checkForUpdates(false)
    } else if (next.auto && status.state === 'available' && status.mode === 'nsis') {
      void autoUpdater.downloadUpdate().catch(() => {})
    }
  })
  ipcMain.handle('update:openRelease', () => shell.openExternal(status.releaseUrl ?? RELEASES_URL))
  ipcMain.handle('update:openLogs', () => shell.openPath(path.dirname(log.transports.file.getFile().path)))

  // Первая проверка — чуть позже старта, чтобы не тормозить запуск; потом каждые 4 часа
  setTimeout(() => void checkForUpdates(false), FIRST_CHECK_DELAY)
  setInterval(() => void checkForUpdates(false), CHECK_INTERVAL)
}

/** Сеть вернулась — если проверка давно не удавалась, пробуем снова */
export function onOnline() {
  if (!status || status.mode === 'dev') return
  const stale = !status.lastCheck || Date.now() - status.lastCheck > 30 * 60 * 1000
  if (stale || status.state === 'available') void checkForUpdates(false)
}

export const hasPendingUpdate = () => status?.state === 'downloaded'

function humanError(err: Error): string {
  const msg = err?.message ?? String(err)
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|net::ERR/i.test(msg)) return 'GitHub недоступен. Попробуй позже.'
  if (/404/.test(msg)) return 'Релизы не найдены (репозиторий приватный или ещё нет ни одного релиза)'
  if (/latest\.yml|beta\.yml|Cannot find channel/i.test(msg)) return 'В релизе нет файла latest.yml — опубликуйте его через workflow'
  if (/sha512 checksum mismatch/i.test(msg)) return 'Файл обновления повреждён, он будет скачан заново'
  return 'Не удалось проверить обновления. Подробности — в логе.'
}
