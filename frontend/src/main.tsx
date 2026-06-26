import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { PrivacyProvider } from './context/PrivacyContext'
import { createQueryClient } from './queries/queryClient'
import './styles/globals.css'

const queryClient = createQueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PrivacyProvider>
          <App />
        </PrivacyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
