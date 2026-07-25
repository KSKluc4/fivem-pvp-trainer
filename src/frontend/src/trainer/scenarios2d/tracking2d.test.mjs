import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_ID, SESSION_DURATION_S, DIFFICULTIES, createTarget, TrackingScorer } from './tracking2d.js'
import { ARENA_BOUNDS_2D } from '../engine2d/spawn2d.js'

const WIDTH = 800
const HEIGHT = 600

function inBounds(target) {
  return target.x >= WIDTH * ARENA_BOUNDS_2D.x[0] && target.x <= WIDTH * ARENA_BOUNDS_2D.x[1]
      && target.y >= HEIGHT * ARENA_BOUNDS_2D.y[0] && target.y <= HEIGHT * ARENA_BOUNDS_2D.y[1]
}

test('exercise metadata', () => {
  assert.equal(EXERCISE_ID, 'tracking_2d')
  assert.equal(SESSION_DURATION_S, 60)
  assert.deepEqual(Object.keys(DIFFICULTIES), ['facil', 'medio', 'dificil'])
})

test('speed and target size scale with difficulty', () => {
  assert.ok(DIFFICULTIES.facil.radiusFrac > DIFFICULTIES.medio.radiusFrac)
  assert.ok(DIFFICULTIES.medio.radiusFrac > DIFFICULTIES.dificil.radiusFrac)
  assert.ok(DIFFICULTIES.facil.speedFrac < DIFFICULTIES.medio.speedFrac)
  assert.ok(DIFFICULTIES.medio.speedFrac < DIFFICULTIES.dificil.speedFrac)
})

test('createTarget spawns inside the arena bounds and stays inside after moving', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    const target = createTarget(WIDTH, HEIGHT, key)
    assert.ok(inBounds(target))
    for (let i = 0; i < 300; i++) {
      target.update(1 / 60)
      assert.ok(inBounds(target), `out of bounds after update: ${JSON.stringify({ x: target.x, y: target.y })}`)
    }
  }
})

test('containsPoint hit-tests against the target radius', () => {
  const target = createTarget(WIDTH, HEIGHT, 'medio')
  assert.ok(target.containsPoint(target.x, target.y))
  assert.ok(!target.containsPoint(target.x + 99999, target.y))
})

// ── TrackingScorer — continuous, no-click scoring ────────────────────────────

test('TrackingScorer scores only time actually spent on-target', () => {
  const scorer = new TrackingScorer()
  scorer.update(500, true)
  scorer.update(500, false)
  scorer.update(300, true)
  assert.equal(scorer.score, 800)
  assert.equal(scorer.totalMs, 1300)
  assert.ok(Math.abs(scorer.accuracyPct - (800 / 1300) * 100) < 1e-9)
})

test('TrackingScorer tracks a running streak that resets when off-target', () => {
  const scorer = new TrackingScorer()
  scorer.update(200, true)
  scorer.update(200, true)
  assert.equal(scorer.currentStreakMs, 400)
  assert.equal(scorer.bestStreakMs, 400)
  scorer.update(100, false)
  assert.equal(scorer.currentStreakMs, 0)
  assert.equal(scorer.bestStreakMs, 400) // best survives the reset
  scorer.update(1000, true)
  assert.equal(scorer.bestStreakMs, 1000)
})
