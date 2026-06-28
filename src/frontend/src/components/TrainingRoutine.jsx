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

export default function TrainingRoutine({ userId, sessionId, routine, username, onViewProgress }) {
  const [completed, setCompleted] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const mainExercises = routine.sections[1]?.exercises || []
  const completedCount = Object.values(completed).filter(Boolean).length

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
          user_id: userId,
          session_id: sessionId,
          exercise_name: '__session__',
          completed: 1,
          session_completed: true,
        })
      }
      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const toolLabel = routine.tool === 'kovaak' ? "KovaaK's" : 'Aim Lab'

  return (
    <div className="routine">
      <div className="routine-header">
        <div>
          <h1>Rotina de Hoje</h1>
          <p className="routine-meta">
            Olá, <strong>{username}</strong>&nbsp;•&nbsp;
            Foco: <span className="tag">{FOCUS_LABELS[routine.focus_area] || routine.focus_area}</span>&nbsp;•&nbsp;
            Ferramenta: <span className="tag">{toolLabel}</span>&nbsp;•&nbsp;
            <span className="tag">{routine.total_duration} min</span>
          </p>
        </div>
        <button className="btn-secondary" onClick={onViewProgress}>
          Ver Progresso
        </button>
      </div>

      {routine.sections.map((section, i) => (
        <div key={i} className="section-card">
          <div className="section-header">
            <h2>{section.name}</h2>
            <span className="section-duration">{section.duration} min</span>
          </div>
          <p className="section-tip">💡 {section.tip}</p>

          {section.exercises.length > 0 ? (
            <div className="exercises-list">
              {section.exercises.map((ex) => {
                const diff = DIFFICULTY_LABELS[ex.difficulty] || { label: ex.difficulty, color: '#8892a4' }
                const isMain = section.name === 'Treino Principal'
                const isDone = !!completed[ex.name]

                return (
                  <div
                    key={ex.name}
                    className={`exercise-card ${isDone ? 'done' : ''}`}
                    onClick={isMain ? () => toggleExercise(ex.name) : undefined}
                    style={{ cursor: isMain ? 'pointer' : 'default' }}
                  >
                    <div className="exercise-left">
                      {isMain && (
                        <div className={`checkbox ${isDone ? 'checked' : ''}`}>{isDone && '✓'}</div>
                      )}
                      <div>
                        <div className="exercise-name">{ex.name}</div>
                        <div className="exercise-desc">{ex.description}</div>
                      </div>
                    </div>
                    <div className="exercise-right">
                      <span className="exercise-duration">{ex.duration} min</span>
                      <span
                        className="difficulty-badge"
                        style={{ color: diff.color, borderColor: diff.color }}
                      >
                        {diff.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-section">
              Sessão de reflexão — anote suas observações no papel ou no app de notas.
            </p>
          )}
        </div>
      ))}

      <div className="routine-footer">
        <div className="progress-summary">
          {completedCount}/{mainExercises.length} exercícios principais concluídos
        </div>
        {!saved ? (
          <button
            className="btn-primary"
            onClick={handleFinish}
            disabled={saving || completedCount === 0}
          >
            {saving ? 'Salvando...' : 'Finalizar Sessão'}
          </button>
        ) : (
          <div className="success-msg">✓ Sessão salva! Bom treino, {username}!</div>
        )}
      </div>
    </div>
  )
}
