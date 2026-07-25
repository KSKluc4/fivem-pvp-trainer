import test from 'node:test'
import assert from 'node:assert/strict'
import { ClickScorer2D } from './clickScorer2d.js'

test('score is the hit count, accuracy is hits/shotsFired', () => {
  const scorer = new ClickScorer2D()
  scorer.registerShot(true, 100)
  scorer.registerShot(false, 0)
  scorer.registerShot(true, 200)
  assert.equal(scorer.score, 2)
  assert.equal(scorer.shotsFired, 3)
  assert.ok(Math.abs(scorer.accuracyPct - (2 / 3) * 100) < 1e-9)
})

test('accuracyPct is 0 before any shot is fired', () => {
  const scorer = new ClickScorer2D()
  assert.equal(scorer.accuracyPct, 0)
})

test('avgReactionMs averages only the hits', () => {
  const scorer = new ClickScorer2D()
  scorer.registerShot(true, 100)
  scorer.registerShot(false, 9999)
  scorer.registerShot(true, 300)
  assert.equal(scorer.avgReactionMs, 200)
})

test('currentStreak increments on hits and resets to 0 on a miss', () => {
  const scorer = new ClickScorer2D()
  scorer.registerShot(true, 0)
  scorer.registerShot(true, 0)
  assert.equal(scorer.currentStreak, 2)
  scorer.registerShot(false, 0)
  assert.equal(scorer.currentStreak, 0)
})

test('bestStreak tracks the highest currentStreak ever reached, surviving later misses', () => {
  const scorer = new ClickScorer2D()
  scorer.registerShot(true, 0)
  scorer.registerShot(true, 0)
  scorer.registerShot(true, 0)
  assert.equal(scorer.bestStreak, 3)
  scorer.registerShot(false, 0)
  scorer.registerShot(true, 0)
  assert.equal(scorer.currentStreak, 1)
  assert.equal(scorer.bestStreak, 3)
})
