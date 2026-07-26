import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  levelPointsForScore, categoryAimLevel, overallAimLevel, recommendedDifficulty,
  poolCategoryScores, categoryOfExercise,
  CALIBRATION, CATEGORIES, MIN_ATTEMPTS, RECENT_WINDOW, MIN_LEVEL, MAX_LEVEL,
} from './aimLevel.js'
import { DRILL_IDS, drillsInCategory } from './catalog.js'

function scoreRows(exercise, difficulty, scores) {
  return scores.map((score) => ({ exercise, difficulty, score }))
}

// ── Catalog/calibration shape ────────────────────────────────────────────

test('CALIBRATION has an entry for every catalog drill, and only those', () => {
  assert.deepEqual([...Object.keys(CALIBRATION)].sort(), [...DRILL_IDS].sort())
})

test('every drill has increasing calibration facil > medio > dificil', () => {
  for (const drill of DRILL_IDS) {
    const t = CALIBRATION[drill]
    assert.deepEqual(Object.keys(t).sort(), ['dificil', 'facil', 'medio'])
    assert.ok(t.facil > t.medio && t.medio > t.dificil, `${drill} calibration must decrease facil > medio > dificil`)
  }
})

// aimLevel.js and api/services/aim_level.py hand-mirror the same CALIBRATION
// table (the frontend can't import Python) — nothing else catches the two
// drifting apart, so parse the Python source and diff the numbers directly.
test('CALIBRATION mirrors the Python copy in api/services/aim_level.py', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url))
  const pyPath = path.join(dir, '..', '..', '..', '..', 'api', 'services', 'aim_level.py')
  const pySource = readFileSync(pyPath, 'utf8')

  const pyCalibration = {}
  const entryRe = /'(\w+)':\s*\{'facil':\s*(\d+),\s*'medio':\s*(\d+),\s*'dificil':\s*(\d+)\}/g
  let match
  while ((match = entryRe.exec(pySource)) !== null) {
    const [, drill, facil, medio, dificil] = match
    pyCalibration[drill] = { facil: Number(facil), medio: Number(medio), dificil: Number(dificil) }
  }

  assert.ok(Object.keys(pyCalibration).length > 0, 'failed to parse any CALIBRATION entries from aim_level.py — regex drifted from the source format')
  assert.deepEqual(pyCalibration, CALIBRATION)
})

// ── levelPointsForScore ──────────────────────────────────────────────────

test('levelPointsForScore at zero score is baseline', () => {
  assert.equal(levelPointsForScore('grid_2d', 'medio', 0), MIN_LEVEL)
})

test('levelPointsForScore at the calibration threshold is five', () => {
  const ref = CALIBRATION.grid_2d.medio
  assert.equal(levelPointsForScore('grid_2d', 'medio', ref), MAX_LEVEL)
})

test('levelPointsForScore caps at five above the threshold', () => {
  const ref = CALIBRATION.grid_2d.medio
  assert.equal(levelPointsForScore('grid_2d', 'medio', ref * 10), MAX_LEVEL)
})

test('levelPointsForScore halfway to the threshold is three', () => {
  const ref = CALIBRATION.grid_2d.medio
  assert.equal(levelPointsForScore('grid_2d', 'medio', ref / 2), 3)
})

test('levelPointsForScore defaults to baseline for unknown exercise/difficulty', () => {
  assert.equal(levelPointsForScore('not_real', 'medio', 999999), MIN_LEVEL)
  assert.equal(levelPointsForScore('grid_2d', 'not_real', 999999), MIN_LEVEL)
})

test('levelPointsForScore defaults to baseline for a non-numeric score', () => {
  assert.equal(levelPointsForScore('grid_2d', 'medio', undefined), MIN_LEVEL)
  assert.equal(levelPointsForScore('grid_2d', 'medio', NaN), MIN_LEVEL)
})

// ── categoryAimLevel ──────────────────────────────────────────────────────

test('categoryAimLevel is null below MIN_ATTEMPTS', () => {
  const scores = scoreRows('grid_2d', 'medio', Array(MIN_ATTEMPTS - 1).fill(50))
  assert.equal(categoryAimLevel(scores), null)
})

test('categoryAimLevel computes at MIN_ATTEMPTS', () => {
  const ref = CALIBRATION.grid_2d.medio
  const scores = scoreRows('grid_2d', 'medio', Array(MIN_ATTEMPTS).fill(ref))
  assert.equal(categoryAimLevel(scores), 5)
})

test('categoryAimLevel only considers the recent window', () => {
  const recent = scoreRows('grid_2d', 'medio', Array(RECENT_WINDOW).fill(0))
  const older  = scoreRows('grid_2d', 'medio', Array(5).fill(999999))
  assert.equal(categoryAimLevel([...recent, ...older]), 1)
})

test('categoryAimLevel pools drills sharing a category, each judged on its own calibration', () => {
  const refGrid = CALIBRATION.grid_2d.medio
  const scores = [
    ...scoreRows('grid_2d', 'medio', [refGrid, refGrid, refGrid]),
    ...scoreRows('clicking_trio_2d', 'medio', [0, 0]),
  ]
  // levels: [5,5,5,1,1] -> mean 3.4 -> round -> 3
  assert.equal(categoryAimLevel(scores), 3)
})

// ── poolCategoryScores ────────────────────────────────────────────────────

test('poolCategoryScores merges only the category\'s own drills, newest-first', () => {
  const scoresByExercise = {
    grid_2d: [{ exercise: 'grid_2d', score: 1, created_at: '2026-01-02' }],
    clicking_trio_2d: [{ exercise: 'clicking_trio_2d', score: 2, created_at: '2026-01-03' }],
    tracking_2d: [{ exercise: 'tracking_2d', score: 3, created_at: '2026-01-04' }],
  }
  const pooled = poolCategoryScores(scoresByExercise, 'clicking')
  assert.deepEqual(pooled.map((s) => s.exercise), ['clicking_trio_2d', 'grid_2d'])
})

// ── overallAimLevel ───────────────────────────────────────────────────────

test('overallAimLevel is null when nothing is computed yet', () => {
  assert.equal(overallAimLevel({ tracking: null, flicking: null }), null)
})

test('overallAimLevel averages only the non-null categories', () => {
  assert.equal(overallAimLevel({ tracking: 4, flicking: null, precision: 2 }), 3)
})

// ── recommendedDifficulty ─────────────────────────────────────────────────

test('recommendedDifficulty defaults to medio without data', () => {
  assert.equal(recommendedDifficulty(null), 'medio')
})

test('recommendedDifficulty maps levels to tiers', () => {
  assert.equal(recommendedDifficulty(1), 'facil')
  assert.equal(recommendedDifficulty(2), 'facil')
  assert.equal(recommendedDifficulty(3), 'medio')
  assert.equal(recommendedDifficulty(4), 'dificil')
  assert.equal(recommendedDifficulty(5), 'dificil')
})

// ── categoryOfExercise ────────────────────────────────────────────────────

test('categoryOfExercise mirrors the catalog for every drill', () => {
  for (const category of CATEGORIES) {
    for (const drill of drillsInCategory(category)) {
      assert.equal(categoryOfExercise(drill.id), category)
    }
  }
})

test('categoryOfExercise returns null for an unknown exercise', () => {
  assert.equal(categoryOfExercise('not_real'), null)
})
