// Per-CATEGORY "aim level" (1-5), mirrored from api/services/aim_level.py —
// the header/dashboard need this in the browser, where the Python module
// can't run. Keep CALIBRATION and the formula below identical to the Python
// copy; recalibrate both together.
//
// ── The whole formula, in one place ─────────────────────────────────────────
//
// 1. Normalize a single score by its own drill AND difficulty:
//        normalized = clamp(score / CALIBRATION[drill][difficulty], 0, 1)
//    CALIBRATION holds ONE number per drill per difficulty: the score that
//    represents top-tier (level 5) performance in a 60s session. This is the
//    only table to touch when recalibrating.
//
// 2. Map it to continuous level points:  points = 1 + 4 * normalized  (1..5)
//
// 3. Category level = round(mean(points)) over the newest RECENT_WINDOW
//    scores POOLED across all of that category's drills (any drill and any
//    difficulty mix — each score was already normalized by its own pair).
//    Below MIN_ATTEMPTS pooled scores the category level is null ("not
//    enough data yet") — exclude it from averages, don't treat it as 1.
//
// 4. Overall aim level = plain mean of the non-null category levels.
//
// Since 3.1.0 the minimum-attempts rule counts per CATEGORY, not per drill —
// 5 sessions spread over any drills of a category unlock its level.

import { CATEGORIES, DRILLS_BY_ID, drillsInCategory } from './catalog.js'

export { CATEGORIES }

// Score worth level 5, per drill per difficulty. The 4 pre-3.1.0 drills use
// their old level-5 thresholds, so an established player lands on a familiar
// level; the new drills start from session-length estimates.
export const CALIBRATION = {
  // tracking — score = ms on target in 60s
  tracking_2d:           { facil: 45000, medio: 38000, dificil: 30000 },
  tracking_zigzag_2d:    { facil: 40000, medio: 32000, dificil: 24000 },
  tracking_paciente_2d:  { facil: 46000, medio: 40000, dificil: 33000 },
  tracking_velocista_2d: { facil: 42000, medio: 34000, dificil: 26000 },
  tracking_pare_siga_2d: { facil: 44000, medio: 36000, dificil: 28000 },
  // clicking — score = hits in 60s
  grid_2d:               { facil: 55, medio: 50, dificil: 42 },
  clicking_trio_2d:      { facil: 60, medio: 55, dificil: 48 },
  clicking_tabuleiro_2d: { facil: 58, medio: 52, dificil: 45 },
  clicking_fugaz_2d:     { facil: 45, medio: 38, dificil: 30 },
  clicking_alfinete_2d:  { facil: 40, medio: 34, dificil: 27 },
  // flicking — score = hits in 60s
  flick_2d:              { facil: 42, medio: 36, dificil: 28 },
  flick_longo_2d:        { facil: 36, medio: 30, dificil: 24 },
  flick_pendulo_2d:      { facil: 40, medio: 34, dificil: 27 },
  flick_isca_2d:         { facil: 34, medio: 28, dificil: 22 },
  flick_corrente_2d:     { facil: 44, medio: 38, dificil: 30 },
  // precision — score = hits (mosca: points, inner ring counts double)
  micro_2d:              { facil: 66, medio: 54, dificil: 42 },
  precisao_minguante_2d: { facil: 40, medio: 34, dificil: 26 },
  // medio/dificil lowered in v3.3.0 alongside the catalog.js radius/rings
  // tightening (see difficultyIndex.js) — the drill got harder, so the same
  // skill now tops out at a lower raw score. facil is untouched (so is its
  // threshold). Scores recorded on the old, easier medio/dificil params
  // still land wherever this new, lower bar puts them — there's no schema
  // field recording which param version a trainer_scores row was played
  // under, and adding one is a migration (CLAUDE.md §2/§5), so this is a
  // knowing, undocumented-in-the-DB tradeoff, not an oversight.
  precisao_mosca_2d:     { facil: 70, medio: 53, dificil: 38 },
  precisao_salto_2d:     { facil: 42, medio: 35, dificil: 28 },
  precisao_fresta_2d:    { facil: 38, medio: 32, dificil: 25 },
  // reaction — score = hits in 60s (spawn delays eat into the clock)
  reacao_gatilho_2d:     { facil: 30, medio: 26, dificil: 20 },
  reacao_dupla_2d:       { facil: 40, medio: 34, dificil: 27 },
  reacao_espera_2d:      { facil: 30, medio: 26, dificil: 20 },
  reacao_rajada_2d:      { facil: 46, medio: 40, dificil: 32 },
  reacao_semaforo_2d:    { facil: 26, medio: 22, dificil: 17 },
}

export const MIN_ATTEMPTS  = 5   // per CATEGORY (pooled across its drills)
export const RECENT_WINDOW = 15  // per CATEGORY (pooled, newest-first)
export const MIN_LEVEL = 1
export const MAX_LEVEL = 5

export const LEVEL_TO_DIFFICULTY = { 1: 'facil', 2: 'facil', 3: 'medio', 4: 'dificil', 5: 'dificil' }

// Steps 1+2 of the formula: one score → continuous level points (1..5).
export function levelPointsForScore(exercise, difficulty, score) {
  const ref = CALIBRATION[exercise]?.[difficulty]
  if (!ref || typeof score !== 'number' || Number.isNaN(score)) return MIN_LEVEL
  const normalized = Math.min(1, Math.max(0, score / ref))
  return 1 + 4 * normalized
}

// Step 3: scores = array of {exercise, difficulty, score, created_at?} for
// ONE category (already pooled), newest-first. Returns 1-5, or null below
// MIN_ATTEMPTS.
export function categoryAimLevel(scores) {
  const window = scores.slice(0, RECENT_WINDOW)
  if (window.length < MIN_ATTEMPTS) return null
  const points = window.map((s) => levelPointsForScore(s.exercise, s.difficulty, s.score))
  const mean = points.reduce((a, b) => a + b, 0) / points.length
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(mean)))
}

// Merges per-exercise score lists (each newest-first) into one newest-first
// pooled list for the category — created_at decides the interleave; rows
// without one (very old local-fallback entries) sort as oldest.
export function poolCategoryScores(scoresByExercise, category) {
  const merged = drillsInCategory(category).flatMap((d) => scoresByExercise[d.id] || [])
  return merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

// {category: level|null} for all 5 categories.
export function perCategoryLevels(scoresByExercise) {
  return Object.fromEntries(
    CATEGORIES.map((cat) => [cat, categoryAimLevel(poolCategoryScores(scoresByExercise, cat))]),
  )
}

// Step 4: average of the non-null category levels, or null if none yet.
export function overallAimLevel(levelsByCategory) {
  const values = Object.values(levelsByCategory).filter((v) => v != null)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function recommendedDifficulty(aimLevel) {
  if (aimLevel == null) return 'medio'
  return LEVEL_TO_DIFFICULTY[Math.round(aimLevel)] || 'medio'
}

export function categoryOfExercise(exerciseId) {
  return DRILLS_BY_ID[exerciseId]?.category || null
}

// {category: lastTrainedTimestampMs} — a category with zero scores ever
// gets -Infinity, i.e. maximally stale, never excluded. poolCategoryScores
// is already newest-first, so its first row is the most recent one. Exported
// (not just used internally) so welcomeState.js can derive "when did this
// player last touch the aim trainer at all" from the same numbers, without
// re-deriving its own pooling logic.
export function categoryLastTrainedTimestamps(scoresByExercise) {
  return Object.fromEntries(
    CATEGORIES.map((category) => {
      const pooled = poolCategoryScores(scoresByExercise, category)
      const lastMs = pooled.length ? new Date(pooled[0].created_at || 0).getTime() : -Infinity
      return [category, lastMs]
    }),
  )
}

// The category the player hasn't touched in the longest time — "menos
// treinada recentemente". A category with no scores at all ranks first
// (never trained is the strongest possible "stale" signal, not a reason to
// skip it).
export function leastRecentCategory(scoresByExercise) {
  const timestamps = categoryLastTrainedTimestamps(scoresByExercise)
  return CATEGORIES.slice().sort((a, b) => timestamps[a] - timestamps[b])[0]
}

// The category with the lowest aim level — "menor nível". No data yet
// (null) ranks below level 1, i.e. as MORE in need of attention than any
// measured level, not excluded from consideration.
export function weakestCategory(perCategoryLevels) {
  const rank = (category) => (perCategoryLevels || {})[category] ?? 0
  return CATEGORIES.slice().sort((a, b) => rank(a) - rank(b))[0]
}

// Combines both signals for a single "train something else today"
// suggestion: lowest level first (the stronger, numeric signal), then least
// recently trained as the tie-break — which is also what carries the whole
// ranking when no category has attempts yet (every level is the same
// "no data" rank). `excludeCategory` keeps a "Variar para X" suggestion from
// just re-suggesting the category the player already repeated.
export function suggestVariationCategory(scoresByExercise, perCategoryLevels, excludeCategory = null) {
  const candidates = CATEGORIES.filter((c) => c !== excludeCategory)
  if (candidates.length === 0) return null
  const timestamps = categoryLastTrainedTimestamps(scoresByExercise)
  const levelRank  = (category) => (perCategoryLevels || {})[category] ?? 0
  return candidates.slice().sort((a, b) => {
    const byLevel = levelRank(a) - levelRank(b)
    return byLevel !== 0 ? byLevel : timestamps[a] - timestamps[b]
  })[0]
}
