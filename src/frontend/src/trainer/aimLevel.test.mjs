import test from 'node:test'
import assert from 'node:assert/strict'
import {
  levelForSingleScore, exerciseAimLevel, overallAimLevel, recommendedDifficulty,
  THRESHOLDS_BY_EXERCISE, EXERCISE_IDS, MIN_ATTEMPTS, RECENT_WINDOW,
} from './aimLevel.js'

function scoreRows(exercise, difficulty, scores) {
  return scores.map((score) => ({ exercise, difficulty, score }))
}

test('all four exercises have increasing thresholds for all three difficulties', () => {
  assert.deepEqual([...EXERCISE_IDS].sort(), ['micro_adjust', 'quick_flick', 'shot_grid', 'tracking_suave'])
  for (const exercise of EXERCISE_IDS) {
    assert.deepEqual(Object.keys(THRESHOLDS_BY_EXERCISE[exercise]).sort(), ['dificil', 'facil', 'medio'])
    for (const difficulty of Object.keys(THRESHOLDS_BY_EXERCISE[exercise])) {
      const t = THRESHOLDS_BY_EXERCISE[exercise][difficulty]
      const values = [2, 3, 4, 5].map((l) => t[l])
      assert.deepEqual(values, [...values].sort((a, b) => a - b))
    }
  }
})

test('levelForSingleScore baseline below the level-2 threshold', () => {
  assert.equal(levelForSingleScore('shot_grid', 'medio', 0), 1)
  assert.equal(levelForSingleScore('shot_grid', 'medio', 19), 1)
})

test('levelForSingleScore hits each threshold exactly', () => {
  const t = THRESHOLDS_BY_EXERCISE.shot_grid.medio
  for (const level of [2, 3, 4, 5]) {
    assert.equal(levelForSingleScore('shot_grid', 'medio', t[level]), level)
  }
})

test('levelForSingleScore caps at 5 above the top threshold', () => {
  const t = THRESHOLDS_BY_EXERCISE.shot_grid.medio
  assert.equal(levelForSingleScore('shot_grid', 'medio', t[5] + 1000), 5)
})

test('levelForSingleScore defaults to baseline for unknown exercise/difficulty', () => {
  assert.equal(levelForSingleScore('not_real', 'medio', 999999), 1)
  assert.equal(levelForSingleScore('shot_grid', 'not_real', 999999), 1)
})

test('exerciseAimLevel is null below MIN_ATTEMPTS', () => {
  const scores = scoreRows('shot_grid', 'medio', Array(MIN_ATTEMPTS - 1).fill(50))
  assert.equal(exerciseAimLevel(scores), null)
})

test('exerciseAimLevel computes at MIN_ATTEMPTS', () => {
  const scores = scoreRows('shot_grid', 'medio', Array(MIN_ATTEMPTS).fill(50))
  assert.equal(exerciseAimLevel(scores), 5)
})

test('exerciseAimLevel only considers the recent window', () => {
  const recent = scoreRows('shot_grid', 'medio', Array(RECENT_WINDOW).fill(5))
  const older  = scoreRows('shot_grid', 'medio', Array(5).fill(999))
  assert.equal(exerciseAimLevel([...recent, ...older]), 1)
})

test('exerciseAimLevel averages mixed difficulties, each judged on its own thresholds', () => {
  const scores = [
    ...scoreRows('shot_grid', 'medio', [50, 50, 50]),
    ...scoreRows('shot_grid', 'facil', [10, 10]),
  ]
  // levels: [5,5,5,1,1] -> mean 3.4 -> round -> 3
  assert.equal(exerciseAimLevel(scores), 3)
})

test('overallAimLevel is null when nothing is computed yet', () => {
  assert.equal(overallAimLevel({ shot_grid: null, quick_flick: null }), null)
})

test('overallAimLevel averages only the non-null exercises', () => {
  assert.equal(overallAimLevel({ shot_grid: 4, quick_flick: null, micro_adjust: 2 }), 3)
})

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
