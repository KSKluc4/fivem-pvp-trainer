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
