import test from 'node:test'
import assert from 'node:assert/strict'

import { analyzeFlick } from './flickAnalysis.js'

test('overshoot: initial impulse covers more than the true angle, then a small negative correction', () => {
  const result = analyzeFlick(
    [
      { tMs: 10, dProgressDeg: 12 },
      { tMs: 20, dProgressDeg: 12 },
      { tMs: 200, dProgressDeg: -4 },
    ],
    20,
  )
  assert.ok(result.ratio > 1.05, `expected overshoot ratio, got ${result.ratio}`)
  assert.equal(result.flickAngleDeg, 24)
  assert.ok(result.correctionTimeMs > 0, 'a correction phase should be detected')
})

test('undershoot: initial impulse falls short of the true angle, needs a second small impulse to arrive', () => {
  const result = analyzeFlick(
    [
      { tMs: 10, dProgressDeg: 8 },
      { tMs: 20, dProgressDeg: 8 },
      { tMs: 150, dProgressDeg: 3 },
    ],
    20,
  )
  assert.ok(result.ratio < 0.95, `expected undershoot ratio, got ${result.ratio}`)
  assert.equal(result.flickAngleDeg, 16)
  assert.ok(result.correctionTimeMs > 0)
})

test('neutral: initial impulse lands almost exactly on the true angle', () => {
  const result = analyzeFlick(
    [
      { tMs: 10, dProgressDeg: 10 },
      { tMs: 20, dProgressDeg: 9.5 },
      { tMs: 200, dProgressDeg: 0.3 },
    ],
    20,
  )
  assert.ok(result.ratio >= 0.95 && result.ratio <= 1.05, `expected neutral ratio, got ${result.ratio}`)
})

test('a single decisive sample with no correction phase at all is a valid (ratio~1, correction=0) flick', () => {
  const result = analyzeFlick([{ tMs: 15, dProgressDeg: 20 }], 20)
  assert.equal(result.ratio, 1)
  assert.equal(result.correctionTimeMs, 0)
})

test('returns null for empty samples or a non-positive true angle', () => {
  assert.equal(analyzeFlick([], 20), null)
  assert.equal(analyzeFlick(null, 20), null)
  assert.equal(analyzeFlick([{ tMs: 10, dProgressDeg: 5 }], 0), null)
  assert.equal(analyzeFlick([{ tMs: 10, dProgressDeg: 5 }], -5), null)
})

test('a monotonically increasing stream that never decelerates counts the whole stream as the flick', () => {
  const result = analyzeFlick(
    [
      { tMs: 10, dProgressDeg: 5 },
      { tMs: 20, dProgressDeg: 6 },
      { tMs: 30, dProgressDeg: 7 },
    ],
    18,
  )
  assert.equal(result.flickAngleDeg, 18)
  assert.equal(result.correctionTimeMs, 0)
})
