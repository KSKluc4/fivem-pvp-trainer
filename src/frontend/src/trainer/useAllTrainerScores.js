import { useState, useEffect, useCallback } from 'react'
import { getTrainerScores } from '../services/api'
import { EXERCISE_IDS } from './scenarios/index.js'

// Loads every exercise's scores in parallel — one request per exercise
// (rather than the unfiltered GET, which caps at 50 rows TOTAL across all
// exercises and would starve whichever ones the player favors less
// recently). Used by the trainer selection screen (per-exercise personal
// bests + overall aim level) and the dashboard's Aim Progress section.
const LOCAL_KEY = 'trainer_scores_fallback_v1'

function loadLocal(exercise) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
    return all.filter((s) => s.exercise === exercise)
  } catch {
    return []
  }
}

export function useAllTrainerScores() {
  const [scoresByExercise, setScoresByExercise] = useState(() =>
    Object.fromEntries(EXERCISE_IDS.map((id) => [id, []])))
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled(EXERCISE_IDS.map((id) => getTrainerScores(id)))
      .then((results) => {
        const next = {}
        EXERCISE_IDS.forEach((id, i) => {
          const r = results[i]
          next[id] = r.status === 'fulfilled' ? r.value.data : loadLocal(id)
        })
        setScoresByExercise(next)
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  return { scoresByExercise, loading, reload: load }
}
