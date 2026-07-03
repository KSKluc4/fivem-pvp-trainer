import { useState, useEffect } from 'react'
import { getGoals, toggleGoal } from '../services/api'
import { toast } from '../services/toast'

function GoalRing({ completed, total }) {
  const pct = total ? (completed / total) * 100 : 0
  return (
    <div className="goal-ring" style={{ '--pct': `${pct}%` }}>
      <span>{completed}/{total}</span>
    </div>
  )
}

function GoalRow({ goal, onToggle, busy }) {
  return (
    <div
      className={`goal-row ${goal.completed ? 'done' : ''} ${busy ? 'busy' : ''}`}
      onClick={() => !busy && onToggle(goal)}
    >
      <div className={`checkbox ${goal.completed ? 'checked' : ''}`}>{goal.completed ? '✓' : ''}</div>
      <div className="goal-row-body">
        <div className="goal-row-title">{goal.title}</div>
        {goal.description && <div className="goal-row-desc">{goal.description}</div>}
      </div>
    </div>
  )
}

function formatDayMonth(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

export default function Goals() {
  const [data, setData]     = useState(null)
  const [error, setError]   = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [pulse, setPulse]   = useState(false)

  const load = () => {
    getGoals()
      .then((res) => { setData(res.data); setError(false) })
      .catch(() => setError(true))
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (goal) => {
    if (busyId || !data) return
    setBusyId(goal.id)

    const period       = goal.period
    const currentList  = data[period]
    const total        = currentList.length
    const wasComplete  = data[`${period}_progress`].completed === total && total > 0
    const newList      = currentList.map((g) => (g.id === goal.id ? { ...g, completed: !g.completed } : g))
    const newCount     = newList.filter((g) => g.completed).length
    const isNowComplete = newCount === total && total > 0

    setData((prev) => ({
      ...prev,
      [period]: newList,
      [`${period}_progress`]: { ...prev[`${period}_progress`], completed: newCount },
    }))

    try {
      await toggleGoal(goal.id)
      if (period === 'daily' && isNowComplete && !wasComplete) {
        toast.success('🎉 Metas do dia completas! Isso conta como um dia ativo no seu streak.')
        setPulse(true)
        setTimeout(() => setPulse(false), 1200)
      }
    } catch (e) {
      toast.error('Não foi possível atualizar a meta. Tente novamente.')
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (error) {
    return (
      <div className="goals-notice">⚠️ Metas indisponíveis no momento — o resto do treino segue normal.</div>
    )
  }

  if (!data) {
    return (
      <div className="goals-section">
        <div className="goals-card"><div className="skeleton skeleton-text w60" /></div>
        <div className="goals-card"><div className="skeleton skeleton-text w60" /></div>
      </div>
    )
  }

  if (!data.available) {
    return (
      <div className="goals-notice">💡 Sistema de metas chegando em breve por aqui.</div>
    )
  }

  const dailyDone = data.daily_progress.total > 0 && data.daily_progress.completed === data.daily_progress.total

  return (
    <div className="goals-section">
      <div className={`goals-card ${dailyDone ? 'goals-card--complete' : ''} ${pulse ? 'goals-card--pulse' : ''}`}>
        <div className="goals-card-header">
          <h3>🎯 Metas de hoje</h3>
          <GoalRing completed={data.daily_progress.completed} total={data.daily_progress.total} />
        </div>
        <div className="goals-list">
          {data.daily.map((g) => (
            <GoalRow key={g.id} goal={g} onToggle={handleToggle} busy={busyId === g.id} />
          ))}
        </div>
        {dailyDone && <div className="goals-celebrate-msg">🏆 Todas as metas de hoje concluídas!</div>}
      </div>

      <div className="goals-card">
        <div className="goals-card-header">
          <h3>📅 Metas da semana</h3>
          <GoalRing completed={data.weekly_progress.completed} total={data.weekly_progress.total} />
        </div>
        <div className="goals-list">
          {data.weekly.map((g) => (
            <GoalRow key={g.id} goal={g} onToggle={handleToggle} busy={busyId === g.id} />
          ))}
        </div>
        <div className="goals-reset-note">Reseta segunda-feira ({formatDayMonth(data.weekly_resets_at)})</div>
      </div>
    </div>
  )
}
