import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Page } from '../components/ui'
import { useTr } from '../i18n'
import { CATEGORIES, type Category } from '../lib/categories'

function CategoryCard({ c, i }: { c: Category; i: number }) {
  const L = useTr()
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(i, 16) * 0.025, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        to={`/category/${c.id}`}
        className="relative block aspect-[16/10] overflow-hidden rounded-2xl p-4 shadow-soft"
        style={{ background: `linear-gradient(135deg, ${c.colors[0]}, ${c.colors[1]})` }}
      >
        <span className="relative z-10 text-[19px] font-extrabold leading-tight text-white drop-shadow-sm">{L(c.ru, c.en)}</span>
        {/* Декоративные круги — «пластинка» в углу */}
        <span className="absolute -bottom-8 -right-6 size-28 rotate-12 rounded-full border-[10px] border-white/20" />
        <span className="absolute -bottom-2 right-3 size-10 rounded-full bg-white/15" />
      </Link>
    </motion.div>
  )
}

export function CategoryGrid() {
  const L = useTr()
  const moods = CATEGORIES.filter((c) => c.kind === 'mood')
  const genres = CATEGORIES.filter((c) => c.kind === 'genre')
  return (
    <>
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-faint">{L('Настроение и занятия', 'Moods & activities')}</h3>
      <div className="mb-8 grid grid-cols-4 gap-4 max-[1150px]:grid-cols-3">
        {moods.map((c, i) => <CategoryCard key={c.id} c={c} i={i} />)}
      </div>
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-faint">{L('Жанры', 'Genres')}</h3>
      <div className="grid grid-cols-4 gap-4 max-[1150px]:grid-cols-3">
        {genres.map((c, i) => <CategoryCard key={c.id} c={c} i={i + moods.length} />)}
      </div>
    </>
  )
}

export default function Categories() {
  const L = useTr()
  return (
    <Page>
      <h1 className="mb-6 text-[32px] font-extrabold tracking-tight">{L('Категории', 'Categories')}</h1>
      <CategoryGrid />
    </Page>
  )
}
