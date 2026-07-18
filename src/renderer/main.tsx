import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TearOffApp } from './TearOffApp'
// Self-hosted display + monospace fonts for the cyberpunk theme. Bundled by
// Vite (served from 'self') so the renderer CSP never has to allow CDN fonts.
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// A `?tearoff=<tabId>` query selects the single-session torn-off view.
const params = new URLSearchParams(window.location.search)
const tearOffTabId = params.get('tearoff')
const tearOffTitle = params.get('title') ?? 'session'

createRoot(container).render(
  <StrictMode>
    {tearOffTabId ? <TearOffApp tabId={tearOffTabId} title={tearOffTitle} /> : <App />}
  </StrictMode>
)
