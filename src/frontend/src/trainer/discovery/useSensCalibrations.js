import { useState, useEffect, useCallback } from 'react'
import { getSensCalibrations, saveSensCalibration, applySensCalibration } from '../../services/api.js'

// The `sens_calibrations` table (migration v11) may not exist yet on a
// freshly-deployed backend — the user applies the SQL manually, after
// deploy. Every call here degrades gracefully instead of surfacing an
// error: history just reads as empty/"unavailable" until the migration
// runs, and a failed save never blocks the result screen from showing the
// verdict the user just earned.
export function useSensCalibrations() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    getSensCalibrations()
      .then((res) => {
        setHistory(res.data || [])
        setAvailable(true)
      })
      .catch(() => {
        setHistory([])
        setAvailable(false)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const save = useCallback(async (payload) => {
    try {
      const res = await saveSensCalibration(payload)
      return res.data
    } catch {
      return null
    }
  }, [])

  const markApplied = useCallback(async (id) => {
    if (id == null) return
    try {
      await applySensCalibration(id)
    } catch {
      // Best-effort — the history badge just won't reflect "aplicado" until
      // the next successful reload.
    }
  }, [])

  return { history, loading, available, reload, save, markApplied }
}
