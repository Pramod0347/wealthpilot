import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

type ThemeContextValue = {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggleTheme: () => {},
})

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('wealthpilot-theme', dark ? 'dark' : 'light')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('wealthpilot-theme')
    const dark = saved !== null ? saved === 'dark' : true
    // Apply synchronously before first paint — no effect delay, no FOUC
    applyTheme(dark)
    return dark
  })

  // Keep DOM in sync on every subsequent toggle
  useLayoutEffect(() => {
    applyTheme(isDark)
  }, [isDark])

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark((v) => !v) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
