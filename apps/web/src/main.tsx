import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './store.css'
import StoreApp from './StoreApp.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreApp />
    </ErrorBoundary>
  </StrictMode>,
)

