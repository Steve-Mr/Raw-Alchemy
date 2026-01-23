import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './i18n'; // Import i18n configuration to initialize it
import './index.css'
import App from './App.jsx'

// Register Service Worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // We can add a toast here later to ask user to reload
    // For now, auto-reload is configured in vite.config.js via registerType: 'autoUpdate'
  },
  onOfflineReady() {
    console.log('App is ready to work offline')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
