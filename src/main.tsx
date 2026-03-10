import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initNative } from './lib/nativeInit'

// Initialize native Android integrations before rendering
// (status bar, splash screen fade-out, etc.)
initNative().catch(console.warn)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
