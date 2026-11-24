import { create } from 'zustand'
import type { Track } from '../lib/types'

export interface ContextMenuState {
  x: number
  y: number
  track: Track
  /** Если меню открыто внутри плейлиста — можно убрать трек из него */
  playlistId?: string
  index?: number
}

export type Dialog =
  | { type: 'auth'; then?: () => void }
  | { type: 'playlist'; id?: string; tracks?: Track[] }
  | { type: 'share'; id: string }
  | { type: 'join'; code?: string }

interface UiState {
  nowPlayingOpen: boolean
  queueOpen: boolean
  eqOpen: boolean
  dialog: Dialog | null
  contextMenu: ContextMenuState | null
  toast: { id: number; text: string } | null
  setNowPlaying: (v: boolean) => void
  toggleQueue: () => void
  setEqOpen: (v: boolean) => void
  openDialog: (d: Dialog) => void
  closeDialog: () => void
  openContextMenu: (m: ContextMenuState) => void
  closeContextMenu: () => void
  showToast: (text: string) => void
}

export const useUi = create<UiState>()((set) => ({
  nowPlayingOpen: false,
  queueOpen: false,
  eqOpen: false,
  dialog: null,
  contextMenu: null,
  toast: null,
  setNowPlaying: (nowPlayingOpen) => set({ nowPlayingOpen }),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  setEqOpen: (eqOpen) => set({ eqOpen }),
  openDialog: (dialog) => set({ dialog, contextMenu: null }),
  closeDialog: () => set({ dialog: null }),
  openContextMenu: (contextMenu) => set({ contextMenu }),
  closeContextMenu: () => set({ contextMenu: null }),
  showToast: (text) => set({ toast: { id: Date.now(), text } }),
}))
