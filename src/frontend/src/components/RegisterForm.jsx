import { useState } from 'react'
import { register } from '../services/api'

function friendlyError(err) {
  if (!err.response) return 'Servidor indisponível. Verifique sua conexão e tente novamente.'
  const msg = err.response?.data?.error || ''
  if (msg) return msg
  const code = err.response?.status
  if (code === 409) return 'Este username já está em uso. Escolha outro.'
  if (code === 400) return 'Dados inválidos. Verifique os campos e tente novamente.'
  if (code >= 500) return 'Erro interno do servidor. Tente novamente em instantes.'
  return 'Ocorreu um erro. Tente novamente.'
}

export default function RegisterForm({ onSuccess, onGoLogin }) {
  const [form,    setForm]    = useState({ name: '', username: '', password: '' })
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const MAX = 5
    for (let attempt = 0; attempt < MAX; attempt++) {
      try {
        const res = await register(form)
        onSuccess(res.data)
        return
      } catch (err) {
        if (err.response || attempt === MAX - 1) {
          setError(friendlyError(err))
          break
        }
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    setLoading(false)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <svg className="auth-logo-svg" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="24" stroke="url(#rg)" strokeWidth="2.5" />
            <circle cx="28" cy="28" r="10" stroke="url(#rg)" strokeWidth="2" />
            <circle cx="28" cy="28" r="3"  fill="url(#rg)" />
            <line x1="28" y1="2"  x2="28" y2="16" stroke="url(#rg)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="28" y1="40" x2="28" y2="54" stroke="url(#rg)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="2"  y1="28" x2="16" y2="28" stroke="url(#rg)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="28" x2="54" y2="28" stroke="url(#rg)" strokeWidth="2.5" strokeLinecap="round" />
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00d4ff" /><stop offset="1" stopColor="#7b2fd4" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div className="auth-brand">FiveM PvP Trainer</div>
            <div className="auth-tagline">TRAINING SYSTEM v1.0</div>
          </div>
        </div>

        <h2 className="auth-title">Criar conta</h2>
        <p className="auth-subtitle">Comece sua jornada de treino personalizado</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Nome completo</label>
            <input
              type="text"
              className="name-input"
              placeholder="João Silva"
              value={form.name}
              onChange={set('name')}
              autoFocus
              autoComplete="name"
              required
            />
          </div>

          <div className="auth-field">
            <label>Username <span className="auth-hint">(mínimo 3 caracteres)</span></label>
            <input
              type="text"
              className="name-input"
              placeholder="joaosilva"
              value={form.username}
              onChange={set('username')}
              autoComplete="username"
              minLength={3}
              required
            />
          </div>

          <div className="auth-field">
            <label>Senha <span className="auth-hint">(mínimo 6 caracteres)</span></label>
            <div className="pw-field">
              <input
                type={showPw ? 'text' : 'password'}
                className="name-input"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((p) => !p)}
                tabIndex={-1}
                aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-msg" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary btn-large btn-glow"
            disabled={loading || !form.name || !form.username || !form.password}
          >
            {loading ? 'Criando conta...' : 'Criar conta →'}
          </button>
        </form>

        <p className="auth-link">
          Já tem conta?{' '}
          <button className="link-btn" onClick={onGoLogin}>
            Entrar
          </button>
        </p>
      </div>
    </div>
  )
}
