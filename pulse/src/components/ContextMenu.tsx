import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Disc3, Heart, ListEnd, ListMinus, ListPlus, ListStart, Mic2, Play, Plus, ThumbsDown } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT, useTr } from '../i18n'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { canEdit, usePlaylists } from '../store/playlists'
import { useTaste } from '../store/taste'
import { useUi } from '../store/ui'

/** Контекстное меню трека (правый клик или «⋯») */
export function ContextMenu() {
  const t = useT()
  const L = useTr()
  const navigate = useNavigate()
  const menu = useUi((s) => s.contextMenu)
  const close = useUi((s) => s.closeContextMenu)
  const showToast = useUi((s) => s.showToast)
  const openDialog = useUi((s) => s.openDialog)
  const allPlaylists = usePlaylists((s) => s.playlists)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [sub, setSub] = useState(false)
  const liked = useLibrary((s) => !!menu && s.liked.some((x) => x.id === menu.track.id))
  const editable = allPlaylists.filter((p) => !p.deleted && canEdit(p))

  useLayoutEffect(() => {
    setSub(false)
    if (!menu || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.min(menu.x, window.innerWidth - r.width - 8), y: Math.min(menu.y, window.innerHeight - r.height - 8) })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('wheel', close, true)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('wheel', close, true)
      window.removeEventListener('blur', close)
    }
  }, [menu, close])

  const act = (fn: () => void) => () => { fn(); close() }
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium hover:bg-hover'
  const subLeft = pos.x + 240 + 230 > window.innerWidth

  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          style={{ left: pos.x || menu.x, top: pos.y || menu.y, transformOrigin: 'top left' }}
          className="fixed z-[100] w-60 rounded-xl border border-line bg-elev p-1.5 shadow-soft"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="truncate px-3 pb-1.5 pt-1 text-[12px] text-muted">{menu.track.artist} — {menu.track.title}</div>
          <button role="menuitem" className={item} onClick={act(() => usePlayer.getState().playTracks([menu.track]))}><Play size={16} /> {t('player.play')}</button>
          <button role="menuitem" className={item} onClick={act(() => { usePlayer.getState().playNext(menu.track); showToast(t('toast.playNext')) })}><ListStart size={16} /> {t('menu.playNext')}</button>
          <button role="menuitem" className={item} onClick={act(() => { usePlayer.getState().addToQueue([menu.track]); showToast(t('toast.queued')) })}><ListEnd size={16} /> {t('menu.addQueue')}</button>
          <div className="my-1 h-px bg-line" />

          <div className="relative" onMouseEnter={() => setSub(true)} onMouseLeave={() => setSub(false)}>
            <button role="menuitem" aria-haspopup="menu" aria-expanded={sub} className={item} onClick={() => setSub((v) => !v)}>
              <ListPlus size={16} /> <span className="flex-1">{L('Добавить в плейлист', 'Add to playlist')}</span> <ChevronRight size={15} className="text-muted" />
            </button>
            {sub && (
              <div role="menu" className={`absolute top-0 max-h-80 w-56 overflow-y-auto rounded-xl border border-line bg-elev p-1.5 shadow-soft ${subLeft ? 'right-full mr-1' : 'left-full ml-1'}`}>
                <button role="menuitem" className={item} onClick={act(() => openDialog({ type: 'playlist', tracks: [menu.track] }))}><Plus size={16} /> {L('Новый плейлист', 'New playlist')}</button>
                {editable.length > 0 && <div className="my-1 h-px bg-line" />}
                {editable.map((p) => (
                  <button key={p.id} role="menuitem" className={item} onClick={act(() => {
                    const n = usePlaylists.getState().addTracks(p.id, [menu.track])
                    showToast(n ? L(`Добавлено в «${p.name}»`, `Added to “${p.name}”`) : L('Уже есть в плейлисте', 'Already in playlist'))
                  })}>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {menu.playlistId && menu.index !== undefined && (
            <button role="menuitem" className={item} onClick={act(() => usePlaylists.getState().removeAt(menu.playlistId!, menu.index!))}><ListMinus size={16} /> {L('Убрать из плейлиста', 'Remove from playlist')}</button>
          )}
          <button role="menuitem" className={item} onClick={act(() => { useLibrary.getState().toggleLike(menu.track); showToast(t(liked ? 'toast.unliked' : 'toast.liked')) })}>
            <Heart size={16} className={liked ? 'fill-ember text-ember' : ''} /> {t(liked ? 'menu.unlike' : 'menu.like')}
          </button>
          {menu.track.source === 'jamendo' && (
            <button role="menuitem" className={item} onClick={act(() => { useTaste.getState().record(menu.track, 'dislike'); showToast(L('Больше не будет в «Потоке»', 'Won’t appear in Flow')) })}>
              <ThumbsDown size={16} /> {L('Не нравится', 'Dislike')}
            </button>
          )}
          {(menu.track.artistId || menu.track.albumId) && menu.track.source === 'jamendo' && <div className="my-1 h-px bg-line" />}
          {menu.track.artistId && menu.track.source === 'jamendo' && (
            <button role="menuitem" className={item} onClick={act(() => navigate(`/artist/${menu.track.artistId}`))}><Mic2 size={16} /> {L('К исполнителю', 'Go to artist')}</button>
          )}
          {menu.track.albumId && menu.track.source === 'jamendo' && (
            <button role="menuitem" className={item} onClick={act(() => navigate(`/album/${menu.track.albumId}`))}><Disc3 size={16} /> {L('К альбому', 'Go to album')}</button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
