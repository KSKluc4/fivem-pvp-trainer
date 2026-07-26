import { useState, useEffect, useCallback } from 'react'
import { getTrainerScores } from '../services/api'
import { DRILL_IDS } from './catalog.js'

// Loads every drill's recent scores in ONE unfiltered request (the API
// returns newest-first across all drills; `limit` covers 25 drills' recent
// windows comfortably) and groups them per exercise id. One call instead of
// one-per-drill — with the 3.1.0 catalog that would be 25 parallel requests
// per screen mount. Used by the trainer selection screen (per-drill personal
// bests + category/overall aim levels) and the dashboard's Aim Progress
// section.
const LOCAL_KEY = 'trainer_scores_fallback_v1'
const FETCH_LIMIT = 500

function loadLocalAll() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
  } catch {
    return []
  }
}

function groupByExercise(rows) {
  const grouped = Object.fromEntries(DRILL_IDS.map((id) => [id, []]))
  for (const row of rows) {
    if (grouped[row.exercise]) grouped[row.exercise].push(row)
  }
  return grouped
}

export function useAllTrainerScores() {
  const [scoresByExercise, setScoresByExercise] = useState(() =>
    Object.fromEntries(DRILL_IDS.map((id) => [id, []])))
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getTrainerScores(undefined, FETCH_LIMIT)
      .then((res) => setScoresByExercise(groupByExercise(res.data)))
      .catch(() => setScoresByExercise(groupByExercise(loadLocalAll())))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return { scoresByExercise, loading, reload: load }
}
