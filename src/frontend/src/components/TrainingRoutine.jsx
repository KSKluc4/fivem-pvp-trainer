import { useState } from 'react'
import { saveProgress } from '../services/api'

const DIFFICULTY_LABELS = {
  beginner: { label: 'Iniciante', color: '#2ed573' },
  intermediate: { label: 'Intermediário', color: '#ffa502' },
  advanced: { label: 'Avançado', color: '#ff4757' },
}

const FOCUS_LABELS = {
  aim: 'Mira',
  reflex: 'Reflexo',
  movement: 'Movimento',
}

const SECTION_ICONS = {
  'Aquecimento': '🔥',
  'Treino Principal': '⚡',
  'Revisão': '📋',
}

const FIVEM_SERVERS = [
  {
    id: 'goat',
    name: 'Goat PvP',
    desc: 'Servidor brasileiro focado em PvP',
    icon: '🐐',
    connectUrl: 'fivem://connect/play.goatpvp.com.br',
    webUrl: 'https://discord.gg/goatpvp',
    color: '#00d4ff',
  },
  {
    id: '1v99',
    name: '1v99',
    desc: 'Arena PvP competitiva',
    icon: '⚔️',
    connectUrl: 'fivem://connect/1v99.gg',
    webUrl: 'https://discord.gg/1v99gg',
    color: '#ff4757',
  },
]

export default function TrainingRoutine({ userId, sessionId, routine, username, onViewProgress }) {
  const [completed, setCompleted] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const mainExercises = routine.sections[1]?.exercises || []
  const completedCount = Object.values(completed).filter(Boolean).length
  const toolLabel = routine.tool === 'kovaak' ? "KovaaK's" : 'Aim Lab'
  const toolClass = routine.tool === 'kovaak' ? 'tool--kovaak' : 'tool--aimlab'

  const toggleExercise = (name) => {
    setCompleted((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      for (const [name, done] of Object.entries(completed)) {
        if (done) {
          await saveProgress({ user_id: userId, session_id: sessionId, exercise_name: name, completed: 1 })
        }
      }
      if (completedCount === mainExercises.length && mainExercises.length > 0) {
        await saveProgress({
          user_id: userId, session_id: sessionId,
          exercise_name: '__session__', completed: 1, session_completed: true,
        })
      }
      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="routine">
      <div className="routine-header">
        <div>
          <h1>Rotina de Hoje</h1>
          <p className="routine-meta">
            Olá, <strong>{username}</strong>&nbsp;•&nbsp;
            Foco: <span className="tag">{FOCUS_LABELS[routine.focus_area] || routine.focus_area}</span>
            &nbsp;•&nbsp;
            <span className={`tag ${toolClass}`}>{toolLabel}</span>
            &nbsp;•&nbsp;
            <span className="tag">{routine.total_duration} min</span>
          </p>
        </div>
        <button className="btn-secondary" onClick={onViewProgress}>
          📊 Progresso
        </button>
      </div>

      {routine.sections.map((section, si) => (
        <div key={si} className={`section-card section-card--${si}`}>
          <div className="section-header">
            <h2>
              <span className="section-icon">{SECTION_ICONS[section.name] || '📌'}</span>
              {section.name}
            </h2>
            <span className="section-duration">{section.duration} min</span>
          </div>
          <div className="section-tip">
            <span className="tip-icon">💡</span>
            <span>{section.tip}</span>
          </div>

          {section.exercises.length > 0 ? (
            <div className="exercises-list">
              {section.exercises.map((ex, idx) => {
                const diff = DIFFICULTY_LABELS[ex.difficulty] || { label: ex.difficulty, color: '#8892a4' }
                const isMain = section.name === 'Treino Principal'
                const isDone = !!completed[ex.name]

                return (
                  <div
                    key={ex.name}
                    className={`exercise-card ${isDone ? 'done' : ''} ${isMain ? 'clickable' : ''}`}
                    onClick={isMain ? () => toggleExercise(ex.name) : undefined}
                  >
                    <div className={`exercise-accent-bar ${toolClass}`} />
                    <div className="exercise-num">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="exercise-body">
                      <div className="exercise-name">{ex.name}</div>
                      <div className="exercise-desc">{ex.description}</div>
                      <div className="exercise-tags">
                        <span className={`tool-badge ${toolClass}`}>{toolLabel}</span>
                        <span
                          className="difficulty-badge"
                          style={{ color: diff.color, borderColor: diff.color }}
                        >
                          {diff.label}
                        </span>
                      </div>
                    </div>
                    <div className="exercise-right">
                      <span className="exercise-duration">{ex.duration} min</span>
                      {isMain && (
                        <div className={`checkbox ${isDone ? 'checked' : ''}`}>
                          {isDone ? '✓' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-section">
              <span>📝</span>
              <span>Sessão de reflexão — anote suas observações e identifique o que melhorou hoje.</span>
            </div>
          )}
        </div>
      ))}

      {/* Footer: progress + finish */}
      <div className="routine-footer">
        <div className="footer-progress">
          <div className="progress-summary">
            {completedCount}/{mainExercises.length} exercícios concluídos
          </div>
          <div className="footer-bar-track">
            <div
              className="footer-bar-fill"
              style={{ width: mainExercises.length ? `${(completedCount / mainExercises.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
        {!saved ? (
          <button
            className="btn-primary"
            onClick={handleFinish}
            disabled={saving || completedCount === 0}
          >
            {saving ? 'Salvando...' : 'Finalizar Sessão ✓'}
          </button>
        ) : (
          <div className="success-msg">🏆 Sessão salva! Bom treino, {username}!</div>
        )}
      </div>

      {/* FiveM Server Links */}
      <div className="server-links-section">
        <div className="server-links-header">
          <h3>Praticar no Servidor</h3>
          <p>Aplique o treino em servidores PvP reais do FiveM</p>
        </div>
        <div className="server-btns">
          {FIVEM_SERVERS.map((srv) => (
            <div key={srv.id} className="server-card" style={{ '--srv-color': srv.color }}>
              <div className="server-card-icon">{srv.icon}</div>
              <div className="server-card-info">
                <div className="server-card-name">{srv.name}</div>
                <div className="server-card-desc">{srv.desc}</div>
              </div>
              <div className="server-card-actions">
                <a
                  href={srv.connectUrl}
                  className="btn-server btn-server--connect"
                  title="Conectar diretamente no FiveM"
                >
                  Conectar
                </a>
                <a
                  href={srv.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-server btn-server--discord"
                  title="Discord do servidor"
                >
                  Discord
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="server-note">
          ⚠️ Atualize os IPs de conexão em <code>TrainingRoutine.jsx</code> com os endereços atuais dos servidores.
        </p>
      </div>
    </div>
  )
}
