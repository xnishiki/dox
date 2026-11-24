import { contextBridge, ipcRenderer } from 'electron'

type Command = 'toggle' | 'next' | 'prev'

// Безопасный мост между интерфейсом и Electron: только нужные функции, без доступа к Node.js
const api = {
  window: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggleMaximize'),
    close: () => ipcRenderer.send('win:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
    onMaximized: (cb: (v: boolean) => void) => {
      const h = (_: unknown, v: boolean) => cb(v)
      ipcRenderer.on('win:maximized', h)
      return () => { ipcRenderer.removeListener('win:maximized', h) }
    },
  },
  tray: {
    update: (state: { playing: boolean; title: string }) => ipcRenderer.send('tray:update', state),
    onCommand: (cb: (cmd: Command) => void) => {
      const h = (_: unknown, cmd: Command) => cb(cmd)
      ipcRenderer.on('player:command', h)
      return () => { ipcRenderer.removeListener('player:command', h) }
    },
  },
}

const extra = {
  local: {
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('local:pickFolder'),
    scan: (): Promise<{ folder: string | null; tracks: LocalTrackDTO[] }> => ipcRenderer.invoke('local:scan'),
    forget: (): Promise<void> => ipcRenderer.invoke('local:forget'),
    onProgress: (cb: (p: { done: number; total: number }) => void) => {
      const h = (_: unknown, p: { done: number; total: number }) => cb(p)
      ipcRenderer.on('local:progress', h)
      return () => { ipcRenderer.removeListener('local:progress', h) }
    },
  },
  deeplink: {
    pending: (): Promise<string | null> => ipcRenderer.invoke('deeplink:pending'),
    on: (cb: (url: string) => void) => {
      const h = (_: unknown, url: string) => cb(url)
      ipcRenderer.on('deeplink', h)
      return () => { ipcRenderer.removeListener('deeplink', h) }
    },
  },
}

interface LocalTrackDTO {
  id: string; title: string; artist: string; album?: string; cover?: string
  duration: number; src: string; source: 'local'; genres: string[]; tags: string[]
}

const full = { ...api, ...extra }
contextBridge.exposeInMainWorld('pulse', full)

export type PulseApi = typeof full
