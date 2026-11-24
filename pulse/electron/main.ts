import { app, BrowserWindow, ipcMain, Menu, nativeImage, session, shell, Tray } from 'electron'
import path from 'node:path'
import { handleLocalProtocol, registerLocalIpc, registerLocalScheme } from './local'

const isDev = !!process.env.VITE_DEV_SERVER_URL
let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let trayState = { playing: false, title: '' }

registerLocalScheme()

// Ссылки-приглашения pulse://join/PULSE-7F3K открывают приложение
const DEEP_SCHEME = 'pulse'
let pendingDeepLink: string | null = null
const findDeepLink = (argv: string[]) => argv.find((a) => a.startsWith(`${DEEP_SCHEME}://`)) ?? null
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(DEEP_SCHEME, process.execPath, [path.resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient(DEEP_SCHEME)
}
pendingDeepLink = findDeepLink(process.argv)

function deliverDeepLink(url: string | null) {
  if (!url) return
  if (win && !win.webContents.isLoading()) win.webContents.send('deeplink', url)
  else pendingDeepLink = url
}

// Только один экземпляр приложения: повторный запуск показывает уже открытое окно
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', (_e, argv) => {
  showWindow()
  deliverDeepLink(findDeepLink(argv))
})

app.setAppUserModelId('app.pulse.music')

function resource(name: string) {
  return isDev ? path.join(__dirname, '..', 'build', name) : path.join(process.resourcesPath, name)
}

function showWindow() {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function sendCommand(cmd: 'toggle' | 'next' | 'prev') {
  win?.webContents.send('player:command', cmd)
}

function buildTrayMenu() {
  if (!tray) return
  tray.setToolTip(trayState.title ? `Pulse — ${trayState.title}` : 'Pulse')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: trayState.title || 'Pulse', enabled: false },
      { type: 'separator' },
      { label: trayState.playing ? 'Пауза' : 'Играть', click: () => sendCommand('toggle') },
      { label: 'Следующий', click: () => sendCommand('next') },
      { label: 'Предыдущий', click: () => sendCommand('prev') },
      { type: 'separator' },
      { label: 'Показать Pulse', click: showWindow },
      { label: 'Выход', click: () => { quitting = true; app.quit() } },
    ]),
  )
}

function createTray() {
  let icon = nativeImage.createFromPath(resource('tray.png'))
  // Запасной вариант — иконка, вшитая в сам интерфейс
  if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, '..', 'dist', 'icon.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }))
  tray.on('click', showWindow)
  buildTrayMenu()
}

// Аудио и обложки Jamendo нужны Web Audio API и чтению цветов обложки,
// а для этого браузеру требуется CORS-заголовок. Добавляем его сами.
function allowCorsForMedia() {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*.jamendo.com/*'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders }
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'access-control-allow-origin') delete headers[key]
      }
      headers['Access-Control-Allow-Origin'] = ['*']
      callback({ responseHeaders: headers })
    },
  )
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: '#0f0f12',
    icon: resource('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win?.show())
  win.on('maximize', () => win?.webContents.send('win:maximized', true))
  win.on('unmaximize', () => win?.webContents.send('win:maximized', false))

  // Крестик сворачивает в трей; полностью закрыть — через меню трея
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  // Внешние ссылки открываем в обычном браузере
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.on('win:minimize', () => win?.minimize())
ipcMain.on('win:toggleMaximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
ipcMain.on('win:close', () => win?.close())
ipcMain.handle('win:isMaximized', () => win?.isMaximized() ?? false)
ipcMain.handle('deeplink:pending', () => {
  const url = pendingDeepLink
  pendingDeepLink = null
  return url
})
registerLocalIpc(() => win)
ipcMain.on('tray:update', (_e, state: { playing: boolean; title: string }) => {
  trayState = state
  buildTrayMenu()
})

app.on('before-quit', () => { quitting = true })

app.whenReady().then(() => {
  handleLocalProtocol()
  allowCorsForMedia()
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
