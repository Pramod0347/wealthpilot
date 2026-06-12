import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

type PrivacyContextValue = {
  privacyMode: boolean
  togglePrivacyMode: () => void
  setPrivacyMode: (value: boolean) => void
}

const PRIVACY_STORAGE_KEY = 'wealthpilot_privacy_mode'

const PrivacyContext = createContext<PrivacyContextValue>({
  privacyMode: false,
  togglePrivacyMode: () => {},
  setPrivacyMode: () => {},
})

function applyPrivacyMode(enabled: boolean) {
  document.documentElement.classList.toggle('privacy-mode', enabled)
  localStorage.setItem(PRIVACY_STORAGE_KEY, enabled ? 'true' : 'false')
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyModeState] = useState<boolean>(() => {
    const saved = localStorage.getItem(PRIVACY_STORAGE_KEY)
    const enabled = saved === 'true'
    applyPrivacyMode(enabled)
    return enabled
  })

  useLayoutEffect(() => {
    applyPrivacyMode(privacyMode)
  }, [privacyMode])

  return (
    <PrivacyContext.Provider
      value={{
        privacyMode,
        togglePrivacyMode: () => setPrivacyModeState((value) => !value),
        setPrivacyMode: (value: boolean) => setPrivacyModeState(value),
      }}
    >
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacyMode(): PrivacyContextValue {
  return useContext(PrivacyContext)
}
