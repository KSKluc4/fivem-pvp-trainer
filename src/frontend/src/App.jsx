import { useState, useEffect } from 'react'
import { AppShell, Text, Center, Stack } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { refreshTokenApi, getTraining, setAccessToken, clearAccessToken } from './services/api'
import { secureStorage } from './services/storage'
import TopBar            from './components/TopBar'
import LoginForm        from './components/LoginForm'
import RegisterForm     from './components/RegisterForm'
import ForgotPasswordForm from './components/ForgotPasswordForm'
import EmailPromptModal from './components/EmailPromptModal'
import Questionnaire    from './components/Questionnaire'
import TrainingRoutine  from './components/TrainingRoutine'
import Progress         from './components/Progress'
import SensConverter    from './components/SensConverter'
import UserMenu         from './components/UserMenu'
import UpdateBanner     from './components/UpdateBanner'
import AdminPanel       from './components/AdminPanel'
import TrainerView      from './trainer/TrainerView'

async function retryNetworkCall(fn, retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn() }
    catch (err) {
      if (err.response || i === retries - 1) throw err
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

export default function App() {
  const { t } = useTranslation()
  const [authState, setAuthState] = useState('loading')
  const [user,      setUser]      = useState(null)
  const [view,      setView]      = useState('loading')
  const [sessionId, setSessionId] = useState(null)
  const [routine,   setRoutine]   = useState(null)
  const [emailPromptOpen, setEmailPromptOpen] = useState(false)
  const [trainerHint, setTrainerHint] = useState(null)

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
        const res = await retryNetworkCall(() => refreshTokenApi(refreshToken))
        const { access_token, refresh_token: newRefresh, user: u } = res.data
        setAccessToken(access_token)
        await secureStorage.set('refresh_token', newRefresh)
        setUser(u)
        setEmailPromptOpen(!u.has_email)
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
    setEmailPromptOpen(!u.has_email)
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
    const msg = authState === 'loading' ? t('comum.loading.iniciando') : t('comum.loading.carregando_rotina')
    return (
      <>
        <TopBar />
        <Center className="loading-screen">
          <Stack align="center" gap="md">
            <div className="loading-crosshair">
              <div className="lc-ring lc-ring-1" />
              <div className="lc-ring lc-ring-2" />
              <div className="lc-dot" />
            </div>
            <Text c="dimmed" size="sm">{msg}</Text>
          </Stack>
        </Center>
      </>
    )
  }

  if (authState === 'login') {
    return (
      <>
        <TopBar />
        <LoginForm
          onSuccess={handleAuthSuccess}
          onGoRegister={() => setAuthState('register')}
          onForgotPassword={() => setAuthState('forgot-password')}
        />
      </>
    )
  }

  if (authState === 'register') {
    return (
      <>
        <TopBar />
        <RegisterForm onSuccess={handleAuthSuccess} onGoLogin={() => setAuthState('login')} />
      </>
    )
  }

  if (authState === 'forgot-password') {
    return (
      <>
        <TopBar />
        <ForgotPasswordForm onGoLogin={() => setAuthState('login')} />
      </>
    )
  }

  return (
    <AppShell header={{ height: 48 }}>
      <AppShell.Header>
        <TopBar>
          {user && (
            <UserMenu
              user={user}
              onLogout={handleLogout}
              onUserUpdate={(updated) => setUser((u) => ({ ...u, ...updated }))}
              onChangeProfile={handleChangeProfile}
              onConverter={() => setView('converter')}
              onTrainer={() => { setTrainerHint(null); setView('trainer') }}
              onAdmin={() => setView('admin')}
            />
          )}
        </TopBar>
      </AppShell.Header>

      <AppShell.Main>
        <UpdateBanner />

        {view === 'questionnaire' && (
          <Questionnaire
            key="questionnaire"
            username={user?.name || ''}
            onComplete={handleQuestionnaireComplete}
          />
        )}

        {view === 'routine' && routine && (
          <TrainingRoutine
            key={`routine-${sessionId}`}
            userId={user?.id}
            sessionId={sessionId}
            routine={routine}
            username={user?.name || ''}
            onViewProgress={() => setView('progress')}
            onChangeProfile={handleChangeProfile}
            onConverter={() => setView('converter')}
            onTrainer={(hint) => { setTrainerHint(hint || null); setView('trainer') }}
          />
        )}

        {view === 'trainer' && (
          <TrainerView
            key="trainer"
            initialHint={trainerHint}
            onBack={() => setView('routine')}
          />
        )}

        {view === 'progress' && (
          <Progress
            key="progress"
            userId={user?.id}
            username={user?.name || ''}
            onBack={() => setView('routine')}
          />
        )}

        {view === 'converter' && (
          <SensConverter
            key="converter"
            onBack={() => setView('routine')}
          />
        )}

        {view === 'admin' && user?.is_admin && (
          <AdminPanel
            key="admin"
            onBack={() => setView('routine')}
          />
        )}
      </AppShell.Main>

      <EmailPromptModal
        opened={emailPromptOpen}
        onClose={() => setEmailPromptOpen(false)}
        onLinked={() => {
          setUser((u) => ({ ...u, has_email: true }))
          setEmailPromptOpen(false)
        }}
      />
    </AppShell>
  )
}
