// Per-exercise "aim level" (1-5), mirrored from api/services/aim_level.py —
// the header/dashboard need this in the browser, where the Python module
// can't run. Keep the thresholds below identical to the Python copy;
// recalibrate both together.
//
// Level for a SINGLE score is looked up from that score's own difficulty
// thresholds. A per-exercise level is the rounded average of the per-score
// levels across the last RECENT_WINDOW scores (any difficulty mixed in is
// fine — each score is judged against its own difficulty first). Below
// MIN_ATTEMPTS scores for that exercise, the level is null ("not enough
// data yet") — exclude it from averages, don't treat it as the worst level.

export const THRESHOLDS_BY_EXERCISE = {
  tracking_suave: {
    facil:   { 2: 15000, 3: 25000, 4: 35000, 5: 45000 },
    medio:   { 2: 10000, 3: 18000, 4: 27000, 5: 38000 },
    dificil: { 2: 6000,  3: 12000, 4: 20000, 5: 30000 },
  },
  shot_grid: {
    facil:   { 2: 25, 3: 35, 4: 45, 5: 55 },
    medio:   { 2: 20, 3: 30, 4: 40, 5: 50 },
    dificil: { 2: 15, 3: 24, 4: 33, 5: 42 },
  },
  quick_flick: {
    facil:   { 2: 18, 3: 26, 4: 34, 5: 42 },
    medio:   { 2: 14, 3: 21, 4: 28, 5: 36 },
    dificil: { 2: 10, 3: 16, 4: 22, 5: 28 },
  },
  micro_adjust: {
    facil:   { 2: 30, 3: 42, 4: 54, 5: 66 },
    medio:   { 2: 24, 3: 34, 4: 44, 5: 54 },
    dificil: { 2: 18, 3: 26, 4: 34, 5: 42 },
  },
}

export const EXERCISE_IDS = Object.keys(THRESHOLDS_BY_EXERCISE)

export const MIN_ATTEMPTS  = 5
export const RECENT_WINDOW = 10
export const MIN_LEVEL = 1
export const MAX_LEVEL = 5

export const LEVEL_TO_DIFFICULTY = { 1: 'facil', 2: 'facil', 3: 'medio', 4: 'dificil', 5: 'dificil' }

export function levelForSingleScore(exercise, difficulty, score) {
  const thresholds = THRESHOLDS_BY_EXERCISE[exercise]?.[difficulty]
  if (!thresholds || typeof score !== 'number' || Number.isNaN(score)) return MIN_LEVEL
  let level = MIN_LEVEL
  for (const lvl of [2, 3, 4, 5]) {
    if (score >= thresholds[lvl]) level = lvl
  }
  return level
}

// scores: array of {exercise, difficulty, score}, newest-first (matches the
// API's ordering). Only the first RECENT_WINDOW entries are considered.
// Returns 1-5, or null if there are fewer than MIN_ATTEMPTS scores.
export function exerciseAimLevel(scores) {
  const window = scores.slice(0, RECENT_WINDOW)
  if (window.length < MIN_ATTEMPTS) return null
  const levels = window.map((s) => levelForSingleScore(s.exercise, s.difficulty, s.score))
  return Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
}

// perExerciseLevels: {exercise: level|null}. Returns the average of the
// non-null levels, or null if none are available yet.
export function overallAimLevel(perExerciseLevels) {
  const values = Object.values(perExerciseLevels).filter((v) => v != null)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function recommendedDifficulty(aimLevel) {
  if (aimLevel == null) return 'medio'
  return LEVEL_TO_DIFFICULTY[Math.round(aimLevel)] || 'medio'
}
