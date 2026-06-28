import { useState, useEffect } from 'react'
import { getMe } from './services/api'
import LoginForm      from './components/LoginForm'
import RegisterForm   from './components/RegisterForm'
import Questionnaire  from './components/Questionnaire'
import TrainingRoutine from './components/TrainingRoutine'
import Progress       from './components/Progress'
import UserMenu       from './components/UserMenu'

export default function App() {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState('loading') // loading | login | register | app
  const [user,      setUser]      = useState(null)

  // ── App view ───────────────────────────────────────────────────────────────
  const [view,      setView]      = useState('questionnaire')
  const [sessionId, setSessionId] = useState(null)
  const [routine,   setRoutine]   = useState(null)

  // ── Boot: restore session from localStorage ────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('pvp_token')
    if (!token) { setAuthState('login'); return }

    getMe()
      .then((res) => { setUser(res.data); setAuthState('app') })
      .catch(() => { localStorage.removeItem('pvp_token'); setAuthState('login') })
  }, [])

  // ── Listen for 401 events from api.js ─────────────────────────────────────
  useEffect(() => {
    const handler = () => handleLogout()
    window.addEventListener('pvp:logout', handler)
    return () => window.removeEventListener('pvp:logout', handler)
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAuthSuccess = (u) => {
    setUser(u)
    setView('questionnaire')
    setSessionId(null)
    setRoutine(null)
    setAuthState('app')
  }

  const handleQuestionnaireComplete = (data) => {
    setSessionId(data.session_id)
    setRoutine(data.routine)
    setView('routine')
  }

  const handleLogout = () => {
    setUser(null)
    setSessionId(null)
    setRoutine(null)
    setView('questionnaire')
    setAuthState('login')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-crosshair">
          <div className="lc-ring lc-ring-1" />
          <div className="lc-ring lc-ring-2" />
          <div className="lc-dot" />
        </div>
      </div>
    )
  }

  if (authState === 'login') {
    return (
      <LoginForm
        onSuccess={handleAuthSuccess}
        onGoRegister={() => setAuthState('register')}
      />
    )
  }

  if (authState === 'register') {
    return (
      <RegisterForm
        onSuccess={handleAuthSuccess}
        onGoLogin={() => setAuthState('login')}
      />
    )
  }

  // Authenticated app
  return (
    <div className="app">
      {/* Always visible top-right user menu */}
      {user && (
        <UserMenu
          user={user}
          onLogout={handleLogout}
          onUserUpdate={(updated) => setUser((u) => ({ ...u, ...updated }))}
        />
      )}

      {view === 'questionnaire' && (
        <Questionnaire
          username={user?.name || ''}
          onComplete={handleQuestionnaireComplete}
        />
      )}

      {view === 'routine' && routine && (
        <TrainingRoutine
          userId={user?.id}
          sessionId={sessionId}
          routine={routine}
          username={user?.name || ''}
          onViewProgress={() => setView('progress')}
        />
      )}

      {view === 'progress' && (
        <Progress
          userId={user?.id}
          username={user?.name || ''}
          onBack={() => setView('routine')}
        />
      )}
    </div>
  )
}
