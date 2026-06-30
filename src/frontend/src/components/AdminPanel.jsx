import { useState, useEffect } from 'react'
import { getAdminStats, getAdminUsers } from '../services/api'

const FOCUS_ICONS  = { Mira: '🎯', Reflexo: '⚡', Movimento: '🏃' }
const SERVER_ICONS = { 'Goat PvP': '🐐', '1v99': '⚔️', Ambos: '🌐', Outro: '🎮' }

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="admin-stat-card" style={{ '--accent': accent }}>
      <div className="admin-stat-value">{value ?? '—'}</div>
      <div className="admin-stat-label">{label}</div>
      {sub && <div className="admin-stat-sub">{sub}</div>}
    </div>
  )
}

function DistBar({ distribution }) {
  if (!distribution || Object.keys(distribution).length === 0) return null
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  return (
    <div className="admin-dist-bars">
      {entries.map(([key, pct]) => (
        <div key={key} className="admin-dist-row">
          <span className="admin-dist-label">{key}</span>
          <div className="admin-dist-track">
            <div className="admin-dist-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="admin-dist-pct">{pct}%</span>
        </div>
      ))}
    </div>
  )
}

function UserRow({ u, idx }) {
  const joined   = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'
  const lastTrain = u.last_session
    ? new Date(u.last_session + 'T12:00:00').toLocaleDateString('pt-BR')
    : '—'
  return (
    <tr className={`admin-user-row ${u.is_admin ? 'admin-user-row--admin' : ''}`}>
      <td className="admin-td admin-td--idx">{idx + 1}</td>
      <td className="admin-td">
        <span className="admin-user-name">{u.name}</span>
        {u.is_admin && <span className="admin-badge">admin</span>}
      </td>
      <td className="admin-td admin-td--mono">@{u.username}</td>
      <td className="admin-td admin-td--date">{joined}</td>
      <td className="admin-td admin-td--date">{lastTrain}</td>
      <td className="admin-td admin-td--num">{u.total_sessions}</td>
    </tr>
  )
}

export default function AdminPanel({ onBack }) {
  const [stats,   setStats]   = useState(null)
  const [users,   setUsers]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    Promise.all([getAdminStats(), getAdminUsers()])
      .then(([sRes, uRes]) => {
        setStats(sRes.data)
        setUsers(uRes.data)
      })
      .catch((e) => setError(e.response?.data?.error || 'Erro ao carregar painel'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users
    ? users.filter((u) =>
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
      )
    : []

  return (
    <div className="admin-view">
      {/* Header */}
      <div className="admin-header">
        <div>
          <h1>⚙️ Painel de Admin</h1>
          <p className="routine-meta">Visão geral da plataforma</p>
        </div>
        <button className="btn-secondary" onClick={onBack}>← Voltar</button>
      </div>

      {loading && (
        <div className="admin-loading">
          <div className="skeleton skeleton-title" style={{ width: '40%' }} />
          <div className="skeleton-grid-4" style={{ marginTop: '1rem' }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-stat" />)}
          </div>
        </div>
      )}

      {error && (
        <div className="section-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-accent)' }}>
          ⚠️ {error}
        </div>
      )}

      {stats && !loading && (
        <>
          {/* ── Main stats ── */}
          <div className="section-card">
            <div className="section-header">
              <h2><span className="section-icon">📊</span> Visão Geral</h2>
            </div>
            <div className="admin-stats-grid">
              <StatCard label="Total de usuários"    value={stats.total_users}              accent="var(--color-primary)" />
              <StatCard label="Ativos (7 dias)"      value={stats.active_users_7d}           accent="var(--color-success)" />
              <StatCard label="Novos (7 dias)"       value={stats.new_users_7d}              accent="var(--color-warning)" />
              <StatCard label="Novos (30 dias)"      value={stats.new_users_30d}             accent="#a78bfa" />
              <StatCard
                label="Sessões completadas"
                value={stats.total_sessions_completed}
                accent="var(--color-secondary)"
              />
            </div>
          </div>

          {/* ── Distributions ── */}
          <div className="admin-dist-grid">
            <div className="section-card">
              <div className="section-header">
                <h2><span className="section-icon">{FOCUS_ICONS[stats.top_focus_label] || '🎯'}</span> Foco de Treino</h2>
                {stats.top_focus_label && (
                  <span className="tag" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--color-primary)' }}>
                    {stats.top_focus_label} {stats.top_focus_pct}%
                  </span>
                )}
              </div>
              <DistBar distribution={stats.focus_distribution} />
              {!stats.top_focus_label && <p className="admin-empty">Nenhum questionário respondido ainda</p>}
            </div>

            <div className="section-card">
              <div className="section-header">
                <h2><span className="section-icon">{SERVER_ICONS[stats.top_server_label] || '🎮'}</span> Servidor Preferido</h2>
                {stats.top_server_label && (
                  <span className="tag" style={{ background: 'rgba(123,47,212,0.1)', color: 'var(--color-secondary)' }}>
                    {stats.top_server_label} {stats.top_server_pct}%
                  </span>
                )}
              </div>
              <DistBar distribution={stats.server_distribution} />
              {!stats.top_server_label && <p className="admin-empty">Nenhum questionário respondido ainda</p>}
            </div>
          </div>

          {/* ── User list ── */}
          <div className="section-card">
            <div className="section-header">
              <h2><span className="section-icon">👥</span> Usuários ({users?.length ?? 0})</h2>
              <input
                className="admin-search"
                type="text"
                placeholder="Buscar nome ou username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {filtered.length === 0 ? (
              <p className="admin-empty">{search ? 'Nenhum usuário encontrado.' : 'Sem usuários.'}</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="admin-th">#</th>
                      <th className="admin-th">Nome</th>
                      <th className="admin-th">Username</th>
                      <th className="admin-th">Cadastro</th>
                      <th className="admin-th">Último treino</th>
                      <th className="admin-th">Sessões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => <UserRow key={u.id} u={u} idx={i} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
