import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ContextMenu } from './components/ContextMenu'
import { Dialogs, joinWithCode } from './components/Dialogs'
import { EqPanel } from './components/EqPanel'
import { NowPlaying } from './components/NowPlaying'
import { PlayerBar } from './components/PlayerBar'
import { QueuePanel } from './components/QueuePanel'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { Toast } from './components/Toast'
import { useHotkeys } from './hooks/useHotkeys'
import { tr } from './i18n'
import { setJamendoClientId, setJamendoQuality } from './lib/jamendo'
import { pulse } from './lib/platform'
import Album from './pages/Album'
import Artist from './pages/Artist'
import Categories from './pages/Categories'
import Category from './pages/Category'
import Flow from './pages/Flow'
import Home from './pages/Home'
import Library from './pages/Library'
import Playlist from './pages/Playlist'
import Search from './pages/Search'
import Settings from './pages/Settings'
import { useAuth } from './store/auth'
import { useSettings } from './store/settings'
import { useUi } from './store/ui'

/** Ссылки pulse://join/PULSE-7F3K из браузера, мессенджера и т. п. */
function useDeepLinks() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!pulse) return
    const handle = (url: string | null) => {
      const code = url?.match(/PULSE-[A-Z0-9]{4}/i)?.[0]?.toUpperCase()
      if (!code) return
      const run = () => {
        joinWithCode(code)
          .then((id) => { navigate(`/playlist/${id}`); useUi.getState().showToast(tr('Плейлист добавлен в медиатеку', 'Playlist added to your library')) })
          .catch(() => useUi.getState().openDialog({ type: 'join', code }))
      }
      if (useAuth.getState().user) run()
      else useUi.getState().openDialog({ type: 'join', code })
    }
    pulse.deeplink.pending().then(handle)
    return pulse.deeplink.on(handle)
  }, [navigate])
}

export default function App() {
  const location = useLocation()
  const theme = useSettings((s) => s.theme)
  const lang = useSettings((s) => s.lang)
  const quality = useSettings((s) => s.quality)
  const jamendoKey = useSettings((s) => s.jamendoClientId)
  const scrollRef = useRef<HTMLElement>(null)
  useHotkeys()
  useDeepLinks()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = lang
  }, [theme, lang])
  useEffect(() => setJamendoQuality(quality), [quality])
  useEffect(() => setJamendoClientId(jamendoKey), [jamendoKey])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [location.pathname])

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1">
          <main ref={scrollRef} className="scroll-area min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/flow" element={<Flow />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/category/:id" element={<Category />} />
                <Route path="/album/:id" element={<Album />} />
                <Route path="/artist/:id" element={<Artist />} />
                <Route path="/playlist/:id" element={<Playlist />} />
                <Route path="/library" element={<Library />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </AnimatePresence>
          </main>
          <QueuePanel />
        </div>
        <NowPlaying />
      </div>
      <PlayerBar />
      <EqPanel />
      <ContextMenu />
      <Dialogs />
      <Toast />
    </div>
  )
}
