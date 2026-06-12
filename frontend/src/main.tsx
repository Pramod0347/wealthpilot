import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { PrivacyProvider } from './context/PrivacyContext'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <PrivacyProvider>
        <App />
      </PrivacyProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
