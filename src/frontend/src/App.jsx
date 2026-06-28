import { useState, useEffect } from 'react'
import { refreshTokenApi, getTraining, setAccessToken, clearAccessToken } from './services/api'
import { secureStorage } from './services/storage'
import LoginForm       from './components/LoginForm'
import RegisterForm    from './components/RegisterForm'
import Questionnaire   from './components/Questionnaire'
import TrainingRoutine from './components/TrainingRoutine'
import Progress        from './components/Progress'
import UserMenu        from './components/UserMenu'

export default function App() {
  const [authState, setAuthState] = useState('loading')
  const [user,      setUser]      = useState(null)
  const [view,      setView]      = useState('loading')
  const [sessionId, setSessionId] = useState(null)
  const [routine,   setRoutine]   = useState(null)

  // Check existing training profile; route accordingly
  async function loadTraining(u) {
    setView('loading')
    try {
      const res = await getTraining(u.id)
      setSessionId(res.data.session_id)
      setRoutine(res.data.routine)
      setView('routine')
    } catch {
      setView('questionnaire')
    }
  }

  // Boot: restore session via refresh token
  useEffect(() => {
    async function boot() {
      const refreshToken = await secureStorage.get('refresh_token')
      if (!refreshToken) { setAuthState('login'); return }

      try {
        const res = await refreshTokenApi(refreshToken)
        const { access_token, refresh_token: newRefresh, user: u } = res.data
        setAccessToken(access_token)
        await secureStorage.set('refresh_token', newRefresh)
        setUser(u)
        setAuthState('app')
        await loadTraining(u)
      } catch {
        await secureStorage.remove('refresh_token')
        clearAccessToken()
        setAuthState('login')
      }
    }
    boot()
  }, [])

  // Handle forced logout from api.js interceptor
  useEffect(() => {
    const handler = () => handleLogout()
    window.addEventListener('pvp:logout', handler)
    return () => window.removeEventListener('pvp:logout', handler)
  }, [])

  // Called by LoginForm / RegisterForm with full JWT response
  const handleAuthSuccess = async ({ access_token, refresh_token, user: u }) => {
    setAccessToken(access_token)
    await secureStorage.set('refresh_token', refresh_token)
    setUser(u)
    setView('loading')
    setAuthState('app')
    await loadTraining(u)
  }

  const handleQuestionnaireComplete = (data) => {
    setSessionId(data.session_id)
    setRoutine(data.routine)
    setView('routine')
  }

  const handleChangeProfile = () => {
    setSessionId(null)
    setRoutine(null)
    setView('questionnaire')
  }

  const handleLogout = async () => {
    const refreshToken = await secureStorage.get('refresh_token')
    await secureStorage.remove('refresh_token')
    clearAccessToken()
    setUser(null); setSessionId(null); setRoutine(null)
    setView('loading'); setAuthState('login')
    // Best-effort server-side token invalidation
    if (refreshToken) {
      try { await import('./services/api').then(m => m.logoutApi(refreshToken)) } catch (_) {}
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (authState === 'loading' || (authState === 'app' && view === 'loading')) {
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

  return (
    <div className="app">
      {user && (
        <UserMenu
          user={user}
          onLogout={handleLogout}
          onUserUpdate={(updated) => setUser((u) => ({ ...u, ...updated }))}
          onChangeProfile={handleChangeProfile}
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
          onChangeProfile={handleChangeProfile}
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
