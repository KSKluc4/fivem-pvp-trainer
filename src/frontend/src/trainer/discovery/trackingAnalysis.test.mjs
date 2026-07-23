import test from 'node:test'
import assert from 'node:assert/strict'

import { TrackingDiscoveryScorer } from './trackingAnalysis.js'

test('averages angular error across frames', () => {
  const scorer = new TrackingDiscoveryScorer()
  scorer.update(16, 2, 0)
  scorer.update(16, 4, 0)
  scorer.update(16, 6, 0)
  assert.equal(scorer.avgErrorDeg, 4)
})

test('counts a sign flip above the noise floor as one crossing', () => {
  const scorer = new TrackingDiscoveryScorer()
  scorer.update(16, 1, 2)
  scorer.update(16, 1, -2)
  scorer.update(16, 1, 2)
  assert.equal(scorer.crossingsPerSecond > 0, true)
})

test('ignores sub-noise jitter around zero — no crossings registered', () => {
  const scorer = new TrackingDiscoveryScorer()
  scorer.update(16, 1, 0.05)
  scorer.update(16, 1, -0.05)
  scorer.update(16, 1, 0.05)
  assert.equal(scorer.crossingsPerSecond, 0)
})

test('a persistent one-sided offset reports a non-zero lag bias in that direction', () => {
  const scorer = new TrackingDiscoveryScorer()
  scorer.update(16, 3, 4)
  scorer.update(16, 3, 5)
  scorer.update(16, 3, 3)
  assert.ok(scorer.avgLagBiasDeg > 0)
})

test('empty scorer reports null averages, not NaN or zero-by-accident', () => {
  const scorer = new TrackingDiscoveryScorer()
  assert.equal(scorer.avgErrorDeg, null)
  assert.equal(scorer.crossingsPerSecond, null)
  assert.equal(scorer.avgLagBiasDeg, null)
})

// ── FPS distortion: averages must be time-weighted, not per-call ───────────

test('avgErrorDeg/avgLagBiasDeg are weighted by dtMs, not a plain per-sample mean', () => {
  // Same three (error, lag) values in both series, but the second spends
  // much longer (a low-FPS stretch) at the value that pulls the average
  // down — a plain per-call mean would report the same average for both
  // (unaffected by dt), the correct time-weighted one must not.
  const evenDt = new TrackingDiscoveryScorer()
  evenDt.update(16, 10, 5)
  evenDt.update(16, 10, 5)
  evenDt.update(16, 2, -5)

  const unevenDt = new TrackingDiscoveryScorer()
  unevenDt.update(16, 10, 5)
  unevenDt.update(16, 10, 5)
  unevenDt.update(200, 2, -5) // a long low-FPS frame dominates real time

  assert.equal(evenDt.avgErrorDeg, (10 + 10 + 2) / 3) // baseline: even dt reduces to a plain mean
  assert.notEqual(unevenDt.avgErrorDeg, evenDt.avgErrorDeg)
  assert.ok(unevenDt.avgErrorDeg < evenDt.avgErrorDeg, 'the long low-FPS frame should pull the average toward its own value')
  assert.notEqual(unevenDt.avgLagBiasDeg, evenDt.avgLagBiasDeg)
  assert.ok(unevenDt.avgLagBiasDeg < evenDt.avgLagBiasDeg, 'same for the lag bias average')

  // And the weighted math itself: sum(value*dt)/totalMs
  const expectedErr = (10 * 16 + 10 * 16 + 2 * 200) / (16 + 16 + 200)
  assert.equal(unevenDt.avgErrorDeg, expectedErr)
})
