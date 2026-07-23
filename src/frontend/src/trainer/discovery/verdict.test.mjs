import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeVerdict, VERDICT, MIN_VALID_FLICKS, MAX_STEP,
  MIN_VALID_TRACKING_ROUNDS, RATIO_OVERSHOOT, RATIO_UNDERSHOOT,
} from './verdict.js'

function repeat(value, n) {
  return new Array(n).fill(value)
}

// ── The four required scenarios ──────────────────────────────────────────

test('a series with clear overshoot recommends DECREASE (overshoot = sens too HIGH), never increase', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.15, 20),
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.DECREASE)
  assert.notEqual(result.verdict, VERDICT.INCREASE)
  assert.ok(result.suggestedSens < 50, 'suggested sens should be lower than the current one')
})

test('a series with clear undershoot recommends INCREASE', () => {
  const result = computeVerdict({
    flickRatios: repeat(0.85, 20),
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.INCREASE)
  assert.ok(result.suggestedSens > 50, 'suggested sens should be higher than the current one')
})

test('a neutral series (ratio ~1.0) recommends KEEP — no change from noise', () => {
  const result = computeVerdict({
    flickRatios: [0.98, 1.0, 1.02, 0.99, 1.01, 1.0, 0.97, 1.03, 1.0, 0.99, 1.01, 1.0, 0.98, 1.02, 1.0, 0.99, 1.0, 1.01, 0.99, 1.0],
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.KEEP)
  assert.equal(result.suggestedSens, undefined)
})

test('an insufficient sample (fewer than the minimum valid flicks) is inconclusive regardless of the ratios', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.5, MIN_VALID_FLICKS - 1),
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.INCONCLUSIVE)
  assert.equal(result.sampleSize, MIN_VALID_FLICKS - 1)
})

test('exactly the minimum valid-flick count is enough to reach a real verdict', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.2, MIN_VALID_FLICKS),
    currentSens: 50,
    dpi: 800,
  })
  assert.notEqual(result.verdict, VERDICT.INCONCLUSIVE)
})

// ── Step clamp: at most +-15 GTA points per test ─────────────────────────

test('an extreme tendency (flick + tracking both maxed) caps the step at MAX_STEP, not beyond', () => {
  const result = computeVerdict({
    flickRatios: repeat(3.0, 20),
    trackingOscillationsHz: repeat(20, 5),
    currentSens: 0,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.DECREASE)
  assert.equal(Math.abs(result.suggestedSens - 0), MAX_STEP)
  assert.equal(MAX_STEP, 15)
})

test('the step never exceeds MAX_STEP across a range of extreme inputs', () => {
  for (const ratio of [1.5, 2.0, 5.0, 10.0]) {
    const result = computeVerdict({ flickRatios: repeat(ratio, 20), currentSens: 0, dpi: 800 })
    assert.ok(Math.abs(result.suggestedSens - 0) <= MAX_STEP, `ratio=${ratio} exceeded MAX_STEP`)
  }
  for (const ratio of [0.1, 0.3, 0.5, 0.7]) {
    const result = computeVerdict({ flickRatios: repeat(ratio, 20), currentSens: 0, dpi: 800 })
    assert.ok(Math.abs(result.suggestedSens - 0) <= MAX_STEP, `ratio=${ratio} exceeded MAX_STEP`)
  }
})

// ── Outer clamp: suggested sens never leaves [-100, 100] ────────────────

test('near the +100 boundary, an increase suggestion clamps to 100 instead of overshooting the GTA scale', () => {
  const result = computeVerdict({
    flickRatios: repeat(0.7, 20),
    currentSens: 92,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.INCREASE)
  assert.equal(result.suggestedSens, 100)
  assert.equal(result.step, 8) // clamped delta, not the raw MAX_STEP request
})

test('near the -100 boundary, a decrease suggestion clamps to -100', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.3, 20),
    currentSens: -93,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.DECREASE)
  assert.equal(result.suggestedSens, -100)
  assert.equal(result.step, 7)
})

// ── Supporting fields ─────────────────────────────────────────────────────

test('reports the overshoot rate used for the "why" sentence', () => {
  const result = computeVerdict({
    flickRatios: [...repeat(1.2, 16), ...repeat(1.0, 4)],
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.overshootRatePct, 80)
})

test('reports the before/after zone transition alongside the suggestion', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.2, 20),
    currentSens: 50,
    dpi: 800,
  })
  assert.ok(typeof result.currentZoneId === 'string')
  assert.ok(typeof result.suggestedZoneId === 'string')
})

// ── DEAD_ZONE is derived from RATIO_OVERSHOOT/RATIO_UNDERSHOOT ──────────────

test('a flick-only ratio just inside RATIO_OVERSHOOT stays in the dead zone (KEEP)', () => {
  const result = computeVerdict({
    flickRatios: repeat(RATIO_OVERSHOOT - 0.001, 20),
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.KEEP)
})

test('a flick-only ratio just past RATIO_OVERSHOOT leaves the dead zone (DECREASE)', () => {
  const result = computeVerdict({
    flickRatios: repeat(RATIO_OVERSHOOT + 0.001, 20),
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.DECREASE)
})

test('a flick-only ratio just past RATIO_UNDERSHOOT (symmetric) leaves the dead zone (INCREASE)', () => {
  const result = computeVerdict({
    flickRatios: repeat(RATIO_UNDERSHOOT - 0.001, 20),
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.INCREASE)
})

// ── Tracking rounds need a minimum surviving count too, like flicks ─────────

test('real gameplay session (trackingRoundsAttempted set) with zero surviving tracking rounds is inconclusive, even with plenty of flicks', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.2, 20),
    trackingOscillationsHz: [],
    trackingRoundsAttempted: 2,
    currentSens: 50,
    dpi: 800,
  })
  assert.equal(result.verdict, VERDICT.INCONCLUSIVE)
})

test('real gameplay session with at least MIN_VALID_TRACKING_ROUNDS surviving still reaches a real verdict', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.2, 20),
    trackingOscillationsHz: repeat(2, MIN_VALID_TRACKING_ROUNDS),
    trackingRoundsAttempted: 2,
    currentSens: 50,
    dpi: 800,
  })
  assert.notEqual(result.verdict, VERDICT.INCONCLUSIVE)
})

test('omitting trackingRoundsAttempted (unit-test / flick-only caller) skips the tracking gate entirely — unchanged behavior', () => {
  const result = computeVerdict({
    flickRatios: repeat(1.2, 20),
    currentSens: 50,
    dpi: 800,
  })
  assert.notEqual(result.verdict, VERDICT.INCONCLUSIVE)
})
