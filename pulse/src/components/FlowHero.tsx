import { motion } from 'framer-motion'
import { AudioWaveform, Loader2, Pause, Play, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { startFlow, useFlow } from '../flow/flow'
import { useTr } from '../i18n'
import { usePlayer } from '../store/player'
import { Visualizer } from './Visualizer'

/** Большая кнопка «Потока» с визуализацией — на главной */
export function FlowHero() {
  const L = useTr()
  const flow = usePlayer((s) => s.flow)
  const playing = usePlayer((s) => s.playing)
  const toggle = usePlayer((s) => s.toggle)
  const loading = useFlow((s) => s.loading && !s.error)
  const active = flow && playing
  const Icon = loading && !flow ? Loader2 : active ? Pause : Play

  return (
    <section className="relative mb-10 flex items-center gap-6 overflow-hidden rounded-3xl bg-surface px-6 py-4 shadow-soft">
      <div className="bg-brand absolute -right-24 -top-24 size-80 rounded-full opacity-20 blur-3xl" />
      <div className="absolute -bottom-28 right-48 size-64 rounded-full bg-mint opacity-10 blur-3xl" />
      <div className="relative grid size-[200px] shrink-0 place-items-center">
        <Visualizer size={200} bars={60} inner={0.3} className="absolute inset-0" />
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          animate={active ? { boxShadow: ['0 0 0 0 rgba(255,138,61,.45)', '0 0 0 18px rgba(255,138,61,0)'] } : { boxShadow: '0 12px 40px rgba(255,106,61,.4)' }}
          transition={active ? { duration: 1.6, repeat: Infinity } : undefined}
          onClick={() => (flow ? toggle() : void startFlow())}
          className="bg-brand relative grid size-[104px] place-items-center rounded-full text-[#1b1208]"
          aria-label={active ? L('Пауза', 'Pause') : L('Запустить Поток', 'Start Flow')}
        >
          <Icon size={38} className={Icon === Loader2 ? 'animate-spin' : Icon === Play ? 'translate-x-0.5 fill-current' : 'fill-current'} />
        </motion.button>
      </div>
      <div className="relative min-w-0">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-sun">
          <AudioWaveform size={15} /> {L('Персональная волна', 'Personal wave')}
        </div>
        <h2 className="mt-1 text-[36px] font-extrabold leading-tight tracking-tight">{L('Поток', 'Flow')}</h2>
        <p className="mt-1 max-w-md text-[14.5px] text-muted">
          {flow ? L('Играет твой Поток. Лайкай и пропускай — он учится на лету.', 'Your Flow is on. Like and skip — it learns as you go.') : L('Бесконечная волна, которая подстраивается под тебя: лайки, пропуски, любимые жанры.', 'An endless wave that adapts to your likes, skips and favourite genres.')}
        </p>
        <Link to="/flow" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-muted hover:text-fg">
          <Settings2 size={15} /> {L('Настроить волну', 'Tune the wave')}
        </Link>
      </div>
    </section>
  )
}
