import { useEffect, useState } from 'react'
import { AuthPage } from './views/AuthPage'
import { LandingPage } from './views/LandingPage'
import { WorkbenchApp } from './views/WorkbenchApp'
import { isAuthenticated, registerUnauthorizedHandler } from './lib/auth'

type Screen = 'landing' | 'auth' | 'workbench'

function App() {
  // Restore session: if a valid token exists in localStorage go straight to workbench
  const [screen, setScreen] = useState<Screen>(() =>
    isAuthenticated() ? 'workbench' : 'landing'
  )

  // Register the global 401 handler once — kicks user back to login on expired token
  useEffect(() => {
    registerUnauthorizedHandler(() => setScreen('auth'))
  }, [])

  if (screen === 'landing') return <LandingPage onLogin={() => setScreen('auth')} onEnter={() => setScreen('auth')} />
  if (screen === 'auth')    return <AuthPage onBackHome={() => setScreen('landing')} onAuthenticate={() => setScreen('workbench')} />
  return <WorkbenchApp />
}

export default App
