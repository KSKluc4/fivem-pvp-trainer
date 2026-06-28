import { useState, useEffect } from 'react'
import { getProgress } from '../services/api'

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Progress({ userId, username, onBack }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProgress(userId)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-crosshair">
          <div className="lc-ring lc-ring-1" />
          <div className="lc-ring lc-ring-2" />
          <div className="lc-dot" />
        </div>
        <p>Carregando progresso...</p>
      </div>
    )
  }

  const totalSessions = data.length
  const completedSessions = data.filter((s) => s.completed).length
  const streak = calcStreak(data)
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0
  const weekCalendar = getWeekCalendar(data)

  return (
    <div className="progress-view">
      <div className="progress-header">
        <div>
          <h1>Seu Progresso</h1>
          <p className="routine-meta">{username}</p>
        </div>
        <button className="btn-secondary" onClick={onBack}>
          ← Voltar ao Treino
        </button>
      </div>

      {/* Weekly Calendar */}
      <div className="section-card">
        <div className="section-header">
          <h2><span className="section-icon">📅</span> Últimos 7 Dias</h2>
          {streak > 0 && (
            <span className="streak-badge">🔥 {streak} dia{streak > 1 ? 's' : ''} seguido{streak > 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="week-calendar">
          {weekCalendar.map((day, i) => (
            <div key={i} className={`week-day ${day.completed ? 'completed' : ''} ${day.today ? 'today' : ''}`}>
              <div className="week-day-label">{day.label}</div>
              <div className="week-day-dot">
                {day.completed ? '✓' : day.today ? '◉' : '○'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          number={totalSessions}
          label="Sessões geradas"
          icon="📋"
          color="var(--color-primary)"
        />
        <StatCard
          number={completedSessions}
          label="Sessões completas"
          icon="✅"
          color="var(--color-success)"
        />
        <StatCard
          number={streak}
          label="Dias seguidos"
          icon="🔥"
          color="var(--color-warning)"
        />
        <StatCard
          number={`${completionRate}%`}
          label="Taxa de conclusão"
          icon="📊"
          color="var(--color-secondary)"
        />
      </div>

      {/* Completion Rate Bar */}
      {totalSessions > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h2><span className="section-icon">📊</span> Taxa de Conclusão</h2>
            <span className="section-duration">{completionRate}%</span>
          </div>
          <div className="rate-bar-track">
            <div
              className="rate-bar-fill"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="rate-labels">
            <span>{completedSessions} completa{completedSessions !== 1 ? 's' : ''}</span>
            <span>{totalSessions - completedSessions} em andamento</span>
          </div>
        </div>
      )}

      {/* History */}
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
                <div className="history-date-block">
                  <span className="history-date">{formatDate(session.date)}</span>
                </div>
                <div className="history-exercises">
                  {session.exercises_logged} exercício(s)
                </div>
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
  const completed = sessions
    .filter((s) => s.completed)
    .map((s) => s.date)
    .sort()
    .reverse()
  if (!completed.length) return 0
  let streak = 0
  let prev = new Date()
  prev.setHours(0, 0, 0, 0)
  for (const d of completed) {
    const curr = new Date(d + 'T00:00:00')
    const diff = Math.round((prev - curr) / 86400000)
    if (diff <= 1) { streak++; prev = curr } else break
  }
  return streak
}

function getWeekCalendar(sessions) {
  const completedDates = new Set(sessions.filter((s) => s.completed).map((s) => s.date))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    return {
      label: DAY_NAMES[d.getDay()],
      completed: completedDates.has(dateStr),
      today: i === 6,
    }
  })
}
