import { useState, useEffect } from 'react'
import { AppShell, Text, Center, Stack } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { refreshTokenApi, getTraining, setAccessToken, clearAccessToken } from './services/api'
import { tokenStore } from './services/storage'
import AppBackground     from './components/AppBackground'
import TopBar            from './components/TopBar'
import Sidebar           from './components/Sidebar'
import LoginForm        from './components/LoginForm'
import RegisterForm     from './components/RegisterForm'
import ForgotPasswordForm from './components/ForgotPasswordForm'
import EmailPromptModal from './components/EmailPromptModal'
import Questionnaire    from './components/Questionnaire'
import TrainingRoutine  from './components/TrainingRoutine'
import Progress         from './components/Progress'
import Sensitivity      from './components/Sensitivity'
import Profile          from './components/Profile'
import UpdateBanner     from './components/UpdateBanner'
import AdminPanel       from './components/AdminPanel'
import TrainerView      from './trainer/TrainerView'
import { syncTrainerSensFromServer } from './trainer/sensitivity/trainerSensitivity'

const SIDEBAR_COLLAPSED_KEY = 'pvp_sidebar_collapsed'
const SIDEBAR_WIDTH_EXPANDED = 240
const SIDEBAR_WIDTH_COLLAPSED = 64

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
  const [pendingCompletion, setPendingCompletion] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')

  // Keep the trainer's local sensitivity cache in sync with the backend's
  // canonical value (see trainerSensitivity.js) — runs on every login/boot,
  // not just once, since `user` also updates on profile edits.
  useEffect(() => { syncTrainerSensFromServer(user) }, [user])

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

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
      const refreshToken = await tokenStore.getRefreshToken()
      if (!refreshToken) { setAuthState('login'); return }

      try {
        const res = await retryNetworkCall(() => refreshTokenApi(refreshToken))
        const { access_token, refresh_token: newRefresh, user: u } = res.data
        setAccessToken(access_token)
        await tokenStore.updateRefreshToken(newRefresh)
        setUser(u)
        setEmailPromptOpen(!u.has_email)
        setAuthState('app')
        await loadTraining(u)
      } catch {
        await tokenStore.clear()
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

  // Called by LoginForm / RegisterForm with the full JWT response. `remember`
  // controls whether the refresh token survives closing the app (LoginForm's
  // "remember me" checkbox) — RegisterForm always remembers the new session.
  const handleAuthSuccess = async ({ access_token, refresh_token, user: u }, remember = true) => {
    setAccessToken(access_token)
    await tokenStore.setRefreshToken(refresh_token, remember)
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
    const refreshToken = await tokenStore.getRefreshToken()
    await tokenStore.clear()
    clearAccessToken()
    setUser(null); setSessionId(null); setRoutine(null)
    setView('loading'); setAuthState('login')
    // Best-effort server-side token invalidation
    if (refreshToken) {
      try { await import('./services/api').then(m => m.logoutApi(refreshToken)) } catch (_) {}
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  // "full" glows/grid on the auth flow, "subtle" everywhere behind the app —
  // rendered once per branch below via the single shared AppBackground.
  const bgIntensity = ['login', 'register', 'forgot-password'].includes(authState) ? 'full' : 'subtle'

  const loadingSpinner = (msg) => (
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
  )

  if (authState === 'loading') {
    return (
      <>
        <AppBackground intensity={bgIntensity} />
        <TopBar />
        {loadingSpinner(t('comum.loading.iniciando'))}
      </>
    )
  }

  if (authState === 'login') {
    return (
      <>
        <AppBackground intensity={bgIntensity} />
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
        <AppBackground intensity={bgIntensity} />
        <TopBar />
        <RegisterForm onSuccess={handleAuthSuccess} onGoLogin={() => setAuthState('login')} />
      </>
    )
  }

  if (authState === 'forgot-password') {
    return (
      <>
        <AppBackground intensity={bgIntensity} />
        <TopBar />
        <ForgotPasswordForm onGoLogin={() => setAuthState('login')} />
      </>
    )
  }

  return (
    <>
      <AppBackground intensity={bgIntensity} />
      <AppShell
        header={{ height: 48 }}
        navbar={{ width: sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED, breakpoint: 0 }}
      >
        <AppShell.Header>
          <TopBar minimal />
        </AppShell.Header>

        <AppShell.Navbar>
          <Sidebar
            user={user}
            activeView={view}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onNavigate={(v) => { if (v === 'trainer') setTrainerHint(null); setView(v) }}
            onLogout={handleLogout}
            onUserUpdate={(updated) => setUser((u) => ({ ...u, ...updated }))}
            onChangeProfile={handleChangeProfile}
          />
        </AppShell.Navbar>

        <AppShell.Main>
          {view === 'loading' && loadingSpinner(t('comum.loading.carregando_rotina'))}

          {view !== 'loading' && <UpdateBanner />}

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
              onSensibilidade={() => setView('sensibilidade')}
              onTrainer={(hint) => { setTrainerHint(hint || null); setView('trainer') }}
              pendingCompletion={pendingCompletion}
              onPendingCompletionConsumed={() => setPendingCompletion(null)}
            />
          )}

          {view === 'trainer' && (
            <TrainerView
              key="trainer"
              initialHint={trainerHint}
              onBack={() => setView('routine')}
              onRoutineComplete={(exerciseName) => {
                setTrainerHint(null)
                setPendingCompletion(exerciseName)
                setView('routine')
              }}
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

          {view === 'sensibilidade' && (
            <Sensitivity
              key="sensibilidade"
              onBack={() => setView('routine')}
            />
          )}

          {view === 'admin' && user?.is_admin && (
            <AdminPanel
              key="admin"
              onBack={() => setView('routine')}
            />
          )}

          {view === 'profile' && (
            <Profile
              key="profile"
              user={user}
              onUserUpdate={(updated) => setUser((u) => ({ ...u, ...updated }))}
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
    </>
  )
}
