import { useState } from 'react'
import { login } from '../services/api'

export default function LoginForm({ onSuccess, onGoRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const MAX = 5
    for (let attempt = 0; attempt < MAX; attempt++) {
      try {
        const res = await login({ username, password })
        onSuccess(res.data)
        return
      } catch (err) {
        // Network error (server not ready yet) → retry; HTTP error → show immediately
        if (err.response || attempt === MAX - 1) {
          setError(err.response?.data?.error || 'Erro ao conectar com o servidor')
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
            <circle cx="28" cy="28" r="24" stroke="url(#ag)" strokeWidth="2.5" />
            <circle cx="28" cy="28" r="10" stroke="url(#ag)" strokeWidth="2" />
            <circle cx="28" cy="28" r="3" fill="url(#ag)" />
            <line x1="28" y1="2"  x2="28" y2="16" stroke="url(#ag)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="28" y1="40" x2="28" y2="54" stroke="url(#ag)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="2"  y1="28" x2="16" y2="28" stroke="url(#ag)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="28" x2="54" y2="28" stroke="url(#ag)" strokeWidth="2.5" strokeLinecap="round" />
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00d4ff" /><stop offset="1" stopColor="#7b2fd4" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div className="auth-brand">FiveM PvP Trainer</div>
            <div className="auth-tagline">TRAINING SYSTEM v1.0</div>
          </div>
        </div>

        <h2 className="auth-title">Entrar</h2>
        <p className="auth-subtitle">Acesse sua conta para continuar treinando</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Username</label>
            <input
              type="text"
              className="name-input"
              placeholder="seu_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label>Senha</label>
            <input
              type="password"
              className="name-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="error-msg">⚠️ {error}</div>}

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={loading || !username || !password}
          >
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>

        <p className="auth-link">
          Não tem conta?{' '}
          <button className="link-btn" onClick={onGoRegister}>
            Criar conta
          </button>
        </p>
      </div>
    </div>
  )
}
