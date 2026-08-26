import { useEffect, useState } from 'react'
import { AuthPage } from './views/AuthPage'
import { LandingPage } from './views/LandingPage'
import { WorkbenchApp } from './views/WorkbenchApp'
import { clearToken, isAuthenticated, registerUnauthorizedHandler } from './lib/auth'
import { useTheme } from './lib/theme'

type Screen = 'landing' | 'auth' | 'workbench'

function App() {
  const [theme, toggleTheme] = useTheme()
  // Restore session: if a valid token exists in localStorage go straight to workbench
  const [screen, setScreen] = useState<Screen>(() =>
    isAuthenticated() ? 'workbench' : 'landing'
  )

  // Register the global 401 handler once — kicks user back to login on expired token
  useEffect(() => {
    registerUnauthorizedHandler(() => setScreen('auth'))
  }, [])

  if (screen === 'landing') return <LandingPage theme={theme} onToggleTheme={toggleTheme} onLogin={() => setScreen('auth')} onEnter={() => setScreen('auth')} />
  if (screen === 'auth')    return <AuthPage theme={theme} onToggleTheme={toggleTheme} onBackHome={() => setScreen('landing')} onAuthenticate={() => setScreen('workbench')} />
  return <WorkbenchApp theme={theme} onToggleTheme={toggleTheme} onLogout={() => { clearToken(); setScreen('landing') }} />
}

export default App
