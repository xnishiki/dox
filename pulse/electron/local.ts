import { app, dialog, ipcMain, protocol, type BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

/**
 * Локальная музыка: выбор папки, сканирование с чтением тегов и обложек,
 * и протокол pulse-file:// для воспроизведения с поддержкой перемотки (Range).
 */
export const LOCAL_SCHEME = 'pulse-file'
const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus'])
const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.jpg': 'image/jpeg', '.png': 'image/png',
}

export interface LocalTrack {
  id: string
  title: string
  artist: string
  album?: string
  cover?: string
  duration: number
  src: string
  source: 'local'
  genres: string[]
  tags: string[]
}

const coversDir = () => path.join(app.getPath('userData'), 'covers')
const cacheFile = () => path.join(app.getPath('userData'), 'local-library.json')
const rootFile = () => path.join(app.getPath('userData'), 'local-root.txt')
let allowedRoot: string | null = null

/** Папка, выбранная пользователем в системном диалоге (интерфейс не может подставить свою) */
async function loadRoot() {
  if (allowedRoot) return allowedRoot
  try { allowedRoot = (await fs.readFile(rootFile(), 'utf8')).trim() || null } catch { allowedRoot = null }
  return allowedRoot
}

const toUrl = (file: string) => `${LOCAL_SCHEME}://local/${encodeURIComponent(file)}`

/** Нужно вызвать до app.ready */
export function registerLocalScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: LOCAL_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  ])
}

function isInside(file: string, root: string) {
  const rel = path.relative(root, file)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

export function handleLocalProtocol() {
  protocol.handle(LOCAL_SCHEME, async (req) => {
    const file = path.normalize(decodeURIComponent(new URL(req.url).pathname.slice(1)))
    // Отдаём только файлы из выбранной папки музыки и кэша обложек
    const root = await loadRoot()
    const isAudio = AUDIO_EXT.has(path.extname(file).toLowerCase())
    const ok = (root && isAudio && isInside(file, root)) || isInside(file, coversDir())
    if (!ok) return new Response('Forbidden', { status: 403 })
    let size: number
    try {
      size = (await fs.stat(file)).size
    } catch {
      return new Response('Not found', { status: 404 })
    }
    const headers: Record<string, string> = {
      'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    }
    const range = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/)
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
      if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
      return new Response(body, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } })
    }
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream
    return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
  })
}

async function walk(dir: string, out: string[], depth = 0) {
  if (depth > 12) return
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, out, depth + 1)
    else if (AUDIO_EXT.has(path.extname(e.name).toLowerCase())) out.push(full)
  }
}

type Cache = Record<string, { mtime: number; track: LocalTrack }>

async function readTrack(file: string): Promise<LocalTrack> {
  const id = 'local:' + createHash('sha1').update(file).digest('hex').slice(0, 16)
  const base: LocalTrack = {
    id, title: path.basename(file, path.extname(file)), artist: 'Неизвестный исполнитель',
    duration: 0, src: toUrl(file), source: 'local', genres: [], tags: [],
  }
  try {
    const mm = await import('music-metadata')
    const meta = await mm.parseFile(file, { duration: true, skipCovers: false })
    const c = meta.common
    let cover: string | undefined
    const pic = c.picture?.[0]
    if (pic?.data?.length) {
      const ext = pic.format.includes('png') ? '.png' : '.jpg'
      const name = createHash('sha1').update(pic.data).digest('hex').slice(0, 20) + ext
      const target = path.join(coversDir(), name)
      await fs.writeFile(target, pic.data, { flag: 'wx' }).catch(() => {})
      cover = toUrl(target)
    }
    return {
      ...base,
      title: c.title || base.title,
      artist: c.artist || c.albumartist || base.artist,
      album: c.album,
      cover,
      duration: meta.format.duration ?? 0,
      genres: (c.genre ?? []).map((g) => g.toLowerCase()),
    }
  } catch {
    return base
  }
}

export async function scanFolder(root: string, onProgress?: (done: number, total: number) => void): Promise<LocalTrack[]> {
  await fs.mkdir(coversDir(), { recursive: true })
  const files: string[] = []
  await walk(root, files)
  let cache: Cache = {}
  try { cache = JSON.parse(await fs.readFile(cacheFile(), 'utf8')) } catch { /* первый запуск */ }
  const next: Cache = {}
  const tracks: LocalTrack[] = []
  let done = 0
  for (const file of files) {
    const mtime = (await fs.stat(file).catch(() => null))?.mtimeMs ?? 0
    const hit = cache[file]
    const track = hit && hit.mtime === mtime ? hit.track : await readTrack(file)
    next[file] = { mtime, track }
    tracks.push(track)
    if (++done % 25 === 0) onProgress?.(done, files.length)
  }
  await fs.writeFile(cacheFile(), JSON.stringify(next)).catch(() => {})
  tracks.sort((a, b) => a.artist.localeCompare(b.artist) || (a.album ?? '').localeCompare(b.album ?? '') || a.title.localeCompare(b.title))
  return tracks
}

export function registerLocalIpc(getWin: () => BrowserWindow | null) {
  ipcMain.handle('local:pickFolder', async () => {
    const win = getWin()
    const res = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Папка с музыкой' })
      : await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Папка с музыкой' })
    if (res.canceled) return null
    allowedRoot = path.normalize(res.filePaths[0])
    await fs.writeFile(rootFile(), allowedRoot).catch(() => {})
    return allowedRoot
  })
  ipcMain.handle('local:scan', async (e) => {
    const root = await loadRoot()
    if (!root) return { folder: null, tracks: [] }
    const tracks = await scanFolder(root, (done, total) => e.sender.send('local:progress', { done, total }))
    return { folder: root, tracks }
  })
  ipcMain.handle('local:forget', async () => {
    allowedRoot = null
    await fs.rm(rootFile(), { force: true }).catch(() => {})
  })
}
