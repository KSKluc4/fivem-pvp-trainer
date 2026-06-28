import { useState, useEffect } from 'react'
import { getProgress } from '../services/api'

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
        <div className="spinner" />
        <p>Carregando progresso...</p>
      </div>
    )
  }

  const totalSessions = data.length
  const completedSessions = data.filter((s) => s.completed).length
  const streak = calcStreak(data)
  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0

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

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{totalSessions}</div>
          <div className="stat-label">Sessões geradas</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{completedSessions}</div>
          <div className="stat-label">Sessões completas</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{streak}</div>
          <div className="stat-label">Dias seguidos</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{completionRate}%</div>
          <div className="stat-label">Taxa de conclusão</div>
        </div>
      </div>

      <div className="section-card">
        <h2>Histórico de Sessões</h2>
        {data.length === 0 ? (
          <p className="empty-section">Nenhuma sessão registrada ainda.</p>
        ) : (
          <div className="history-list">
            {data.map((session, i) => (
              <div key={i} className={`history-item ${session.completed ? 'completed' : ''}`}>
                <div className="history-date">{formatDate(session.date)}</div>
                <div className="history-exercises">
                  {session.exercises_logged} exercício(s) registrado(s)
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
    if (diff <= 1) {
      streak++
      prev = curr
    } else {
      break
    }
  }
  return streak
}
