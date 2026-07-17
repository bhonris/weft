import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TearOffApp } from './TearOffApp'
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
