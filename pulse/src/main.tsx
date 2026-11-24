import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { initAudioBindings } from './audio/bindings'
import { initFlow } from './flow/flow'
import { setJamendoClientId, setJamendoQuality } from './lib/jamendo'
import { initAuth } from './store/auth'
import { initEqBinding } from './store/eq'
import { useSettings } from './store/settings'
import { initSync } from './sync/sync'
import './index.css'

// Ключи и качество — до первых запросов
const settings = useSettings.getState()
setJamendoClientId(settings.jamendoClientId)
setJamendoQuality(settings.quality)
document.documentElement.dataset.theme = settings.theme

initAudioBindings()
initEqBinding()
initFlow()
initSync()
initAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: приложение открывается из файла (file://), обычная история браузера там не работает */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
