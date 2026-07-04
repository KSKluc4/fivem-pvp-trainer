import { useState, useEffect, useCallback } from 'react'
import { getTrainerScores, postTrainerScore } from '../services/api'

// Falls back to localStorage when the backend table isn't migrated yet (or
// the request otherwise fails) — the trainer keeps working, just without
// cross-device sync, and the results screen says so.
const LOCAL_KEY = 'trainer_scores_fallback_v1'
const LOCAL_CAP = 20

function loadLocal(exercise) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
    return all.filter((s) => s.exercise === exercise)
  } catch {
    return []
  }
}

function saveLocal(entry) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
    all.unshift(entry)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all.slice(0, LOCAL_CAP)))
  } catch {
    // Storage unavailable — the session's result still shows on the results
    // screen this one time, it just won't persist across restarts.
  }
}

export function useTrainerScores(exercise) {
  const [scores, setScores] = useState([])
  const [remoteAvailable, setRemoteAvailable] = useState(true)

  const load = useCallback(() => {
    getTrainerScores(exercise)
      .then((res) => { setScores(res.data); setRemoteAvailable(true) })
      .catch(() => { setScores(loadLocal(exercise)); setRemoteAvailable(false) })
  }, [exercise])

  useEffect(() => { load() }, [load])

  // Best-per-difficulty / last-per-difficulty lookups, computed from
  // whatever scores are currently loaded (both API and local fallback
  // return newest-first).
  function lastAttemptFor(difficulty) {
    return scores.find((s) => s.difficulty === difficulty) || null
  }

  function personalBestFor(difficulty) {
    return scores
      .filter((s) => s.difficulty === difficulty)
      .reduce((best, s) => (!best || s.score > best.score ? s : best), null)
  }

  const saveScore = useCallback(async (entry) => {
    try {
      const res = await postTrainerScore(entry)
      setScores((prev) => [res.data, ...prev])
      return { savedRemotely: true }
    } catch {
      const optimistic = { ...entry, created_at: new Date().toISOString() }
      saveLocal(optimistic)
      setScores((prev) => [optimistic, ...prev])
      return { savedRemotely: false }
    }
  }, [])

  return { lastAttemptFor, personalBestFor, saveScore, remoteAvailable }
}
