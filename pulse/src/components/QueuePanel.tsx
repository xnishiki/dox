import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { GripVertical, X } from 'lucide-react'
import { useT } from '../i18n'
import { formatTime } from '../lib/format'
import { usePlayer, type QueueItem } from '../store/player'
import { useUi } from '../store/ui'
import { Cover } from './Cover'
import { PlayingBars } from './PlayingBars'
import { openTrackMenu } from './TrackList'

function UpcomingRow({ item, onPlay }: { item: QueueItem; onPlay: () => void }) {
  const controls = useDragControls()
  const remove = usePlayer((s) => s.removeFromQueue)
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="group flex h-14 items-center gap-2 rounded-xl bg-bg px-1.5 hover:bg-surface"
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,.35)' }}
      onDoubleClick={onPlay}
      onContextMenu={(e) => openTrackMenu(e, item)}
    >
      <button
        className="grid h-full w-5 cursor-grab touch-none place-items-center text-faint active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Перетащить"
      >
        <GripVertical size={15} />
      </button>
      <Cover src={item.cover} className="size-10" rounded="rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{item.title}</div>
        <div className="truncate text-[12px] text-muted">{item.artist}</div>
      </div>
      <span className="text-[12px] tabular-nums text-muted group-hover:hidden">{formatTime(item.duration)}</span>
      <button className="hidden size-7 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg group-hover:grid" onClick={() => remove(item.qid)} aria-label="Убрать из очереди">
        <X size={15} />
      </button>
    </Reorder.Item>
  )
}

export function QueuePanel() {
  const t = useT()
  const open = useUi((s) => s.queueOpen)
  const toggleQueue = useUi((s) => s.toggleQueue)
  const { queue, index, playing, playAt, reorderUpcoming, clearUpcoming } = usePlayer()
  const current = queue[index]
  const upcoming = queue.slice(index + 1)

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="flex w-[340px] shrink-0 flex-col border-l border-line bg-bg max-[1100px]:absolute max-[1100px]:inset-y-0 max-[1100px]:right-0 max-[1100px]:z-20 max-[1100px]:shadow-soft"
        >
          <div className="flex h-14 items-center justify-between px-4">
            <h2 className="text-[16px] font-bold">{t('queue.title')}</h2>
            <button className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" onClick={toggleQueue} aria-label={t('player.collapse')}>
              <X size={18} />
            </button>
          </div>
          <div className="scroll-area flex-1 px-3 pb-4">
            {!current ? (
              <p className="px-2 py-10 text-center text-[13px] text-muted">{t('queue.empty')}</p>
            ) : (
              <>
                <div className="px-1.5 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{t('queue.now')}</div>
                <div className="flex h-14 items-center gap-3 rounded-xl bg-surface px-2">
                  <Cover src={current.cover} className="size-10" rounded="rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-sun">{current.title}</div>
                    <div className="truncate text-[12px] text-muted">{current.artist}</div>
                  </div>
                  <PlayingBars paused={!playing} className="mr-1" />
                </div>

                {upcoming.length > 0 && (
                  <>
                    <div className="mt-5 flex items-center justify-between px-1.5 pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                        {t('queue.next')} · {upcoming.length}
                      </span>
                      <button className="text-[12px] font-semibold text-muted hover:text-fg" onClick={clearUpcoming}>
                        {t('queue.clear')}
                      </button>
                    </div>
                    <Reorder.Group axis="y" values={upcoming} onReorder={reorderUpcoming} className="flex flex-col gap-0.5">
                      {upcoming.map((item, i) => (
                        <UpcomingRow key={item.qid} item={item} onPlay={() => playAt(index + 1 + i)} />
                      ))}
                    </Reorder.Group>
                  </>
                )}
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
