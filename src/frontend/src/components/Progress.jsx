import { useState, useEffect } from 'react'
import { getProgress } from '../services/api'

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const ACHIEVEMENTS = [
  { id: 'first',   name: 'Primeira Batalha', desc: 'Complete 1 sessão',        icon: '🎯', goal: 1,  key: 'completed' },
  { id: 'streak3', name: 'Em Chamas',        desc: '3 dias consecutivos',       icon: '🔥', goal: 3,  key: 'streak'    },
  { id: 'sess5',   name: 'Consistente',      desc: '5 sessões completas',       icon: '⚔️', goal: 5,  key: 'completed' },
  { id: 'streak7', name: 'Semana Perfeita',  desc: '7 dias seguidos',           icon: '💫', goal: 7,  key: 'streak'    },
  { id: 'sess10',  name: 'Dedicado',         desc: '10 sessões completas',      icon: '🏅', goal: 10, key: 'completed' },
  { id: 'sess30',  name: 'Veterano',         desc: '30 sessões completas',      icon: '🏆', goal: 30, key: 'completed' },
]

export default function Progress({ userId, username, onBack }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProgress(userId)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="progress-view">
        <div className="progress-header">
          <div>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text w60" />
          </div>
        </div>
        {/* Week calendar skeleton */}
        <div className="skeleton-card">
          <div className="skeleton skeleton-text w60" style={{ marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-stat" style={{ height: 56 }} />
            ))}
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="skeleton-grid-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-stat" />
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="skeleton-card">
          <div className="skeleton skeleton-text w60" style={{ marginBottom: '1rem' }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-bar" style={{ marginBottom: '0.7rem' }} />
          ))}
        </div>
        {/* History skeleton */}
        <div className="skeleton-card">
          <div className="skeleton skeleton-text w60" style={{ marginBottom: '1rem' }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      </div>
    )
  }

  const total          = data.length
  const completed      = data.filter((s) => s.completed).length
  const streak         = calcStreak(data)
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const weekCalendar   = getWeekCalendar(data)
  const weeklyData     = getWeeklyData(data)
  const stats          = { completed, streak }

  return (
    <div className="progress-view">
      <div className="progress-header">
        <div>
          <h1>Seu Progresso</h1>
          <p className="routine-meta">{username}</p>
        </div>
        <button className="btn-secondary" onClick={onBack}>← Voltar ao Treino</button>
      </div>

      {/* ── Weekly Calendar ── */}
      <div className="section-card">
        <div className="section-header">
          <h2><span className="section-icon">📅</span> Últimos 7 Dias</h2>
          {streak > 0 && (
            <span className="streak-badge">🔥 {streak} dia{streak !== 1 ? 's' : ''} seguido{streak !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="week-calendar">
          {weekCalendar.map((day, i) => (
            <div key={i} className={`week-day ${day.completed ? 'completed' : ''} ${day.today ? 'today' : ''}`}>
              <div className="week-day-label">{day.label}</div>
              <div className="week-day-dot">{day.completed ? '✓' : day.today ? '◉' : '○'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid">
        <StatCard number={total}          label="Sessões geradas"   icon="📋" color="var(--color-primary)"   />
        <StatCard number={completed}      label="Sessões completas" icon="✅" color="var(--color-success)"   />
        <StatCard number={streak}         label="Dias seguidos"     icon="🔥" color="var(--color-warning)"   />
        <StatCard number={`${completionRate}%`} label="Conclusão"   icon="📊" color="var(--color-secondary)" />
      </div>

      {/* ── Weekly Evolution Chart ── */}
      {weeklyData.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h2><span className="section-icon">📈</span> Evolução Semanal</h2>
          </div>
          <div className="weekly-chart">
            {weeklyData.map((week, i) => (
              <div key={i} className="chart-row">
                <div className="chart-row-label">{week.label}</div>
                <div className="chart-row-bar">
                  <div className="chart-bar-track">
                    <div className="chart-bar-total"  style={{ width: `${(week.total    / 7) * 100}%` }} />
                    <div className="chart-bar-filled" style={{ width: `${(week.completed / 7) * 100}%` }} />
                  </div>
                </div>
                <div className="chart-row-stat">
                  <span className="chart-completed">{week.completed}</span>
                  <span className="chart-sep">/</span>
                  <span className="chart-total">{week.total}</span>
                  {week.completed === week.total && week.total > 0 && (
                    <span className="chart-star">★</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Completion Rate Bar ── */}
      {total > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h2><span className="section-icon">📊</span> Taxa de Conclusão</h2>
            <span className="section-duration">{completionRate}%</span>
          </div>
          <div className="rate-bar-track">
            <div className="rate-bar-fill" style={{ width: `${completionRate}%` }} />
          </div>
          <div className="rate-labels">
            <span>{completed} completa{completed !== 1 ? 's' : ''}</span>
            <span>{total - completed} em andamento</span>
          </div>
        </div>
      )}

      {/* ── Achievements ── */}
      <div className="section-card">
        <h2 style={{ marginBottom: '1rem' }}>
          <span className="section-icon">🏅</span> Conquistas
        </h2>
        <div className="achievements-grid">
          {ACHIEVEMENTS.map((ach) => {
            const current = stats[ach.key] ?? 0
            const unlocked = current >= ach.goal
            const pct      = Math.min((current / ach.goal) * 100, 100)
            return (
              <div key={ach.id} className={`achievement-card ${unlocked ? 'unlocked' : ''}`}>
                <div className="ach-icon">{ach.icon}</div>
                <div className="ach-name">{ach.name}</div>
                <div className="ach-desc">{ach.desc}</div>
                {unlocked ? (
                  <div className="ach-status unlocked">✓ Desbloqueado</div>
                ) : (
                  <>
                    <div className="ach-bar-track">
                      <div className="ach-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="ach-progress">{current}/{ach.goal}</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Session History ── */}
      <div className="section-card">
        <h2><span className="section-icon">🗂️</span> Histórico de Sessões</h2>
        {data.length === 0 ? (
          <div className="empty-section">
            <span>📭</span>
            <span>Nenhuma sessão registrada ainda. Complete sua primeira rotina!</span>
          </div>
        ) : (
          <div className="history-list">
            {data.map((session, i) => (
              <div key={i} className={`history-item ${session.completed ? 'completed' : ''}`}>
                <div className="history-date">{formatDate(session.date)}</div>
                <div className="history-exercises">{session.exercises_logged} exercício(s)</div>
                <div className={`history-status ${session.completed ? 'done' : 'pending'}`}>
                  {session.completed ? '✓ Completo' : '● Em andamento'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ number, label, icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-number" style={{ color }}>{number}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function calcStreak(sessions) {
  const completed = sessions.filter((s) => s.completed).map((s) => s.date).sort().reverse()
  if (!completed.length) return 0
  let streak = 0
  let prev   = new Date(); prev.setHours(0, 0, 0, 0)
  for (const d of completed) {
    const curr = new Date(d + 'T00:00:00')
    if (Math.round((prev - curr) / 86400000) <= 1) { streak++; prev = curr } else break
  }
  return streak
}

function getWeekCalendar(sessions) {
  const completedDates = new Set(sessions.filter((s) => s.completed).map((s) => s.date))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    return { label: DAY_NAMES[d.getDay()], completed: completedDates.has(dateStr), today: i === 6 }
  })
}

function getWeeklyData(sessions) {
  const weeks = {}
  sessions.forEach((s) => {
    if (!s.date) return
    const d   = new Date(s.date + 'T00:00:00')
    const day = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const key = mon.toISOString().split('T')[0]
    if (!weeks[key]) weeks[key] = { total: 0, completed: 0, mon }
    weeks[key].total++
    if (s.completed) weeks[key].completed++
  })
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4)
    .map(([, w]) => ({ ...w, label: weekLabel(w.mon) }))
}

function weekLabel(mon) {
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const f   = (d) => `${d.getDate()}/${d.getMonth() + 1}`
  return `${f(mon)}–${f(sun)}`
}
