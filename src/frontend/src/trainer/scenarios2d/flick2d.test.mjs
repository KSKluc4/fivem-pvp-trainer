import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_ID, SESSION_DURATION_S, DIFFICULTIES, createTarget } from './flick2d.js'
import { ARENA_BOUNDS_2D } from '../engine2d/spawn2d.js'

const WIDTH = 800
const HEIGHT = 600

test('exercise metadata', () => {
  assert.equal(EXERCISE_ID, 'flick_2d')
  assert.equal(SESSION_DURATION_S, 60)
  assert.deepEqual(Object.keys(DIFFICULTIES), ['facil', 'medio', 'dificil'])
})

test('timeout is fixed at 1.2s across all difficulties', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    assert.equal(DIFFICULTIES[key].timeoutMs, 1200)
  }
})

test('radius shrinks and flick distance grows as difficulty increases', () => {
  assert.ok(DIFFICULTIES.facil.radiusFrac > DIFFICULTIES.medio.radiusFrac)
  assert.ok(DIFFICULTIES.medio.radiusFrac > DIFFICULTIES.dificil.radiusFrac)
  assert.ok(DIFFICULTIES.facil.distanceRangeFrac[1] < DIFFICULTIES.dificil.distanceRangeFrac[1])
})

test('createTarget spawns inside ARENA_BOUNDS_2D regardless of where the cursor is', () => {
  for (let i = 0; i < 30; i++) {
    const cursor = { x: Math.random() * WIDTH, y: Math.random() * HEIGHT }
    const target = createTarget(WIDTH, HEIGHT, 'dificil', () => cursor)
    assert.ok(target.x >= WIDTH * ARENA_BOUNDS_2D.x[0] && target.x <= WIDTH * ARENA_BOUNDS_2D.x[1])
    assert.ok(target.y >= HEIGHT * ARENA_BOUNDS_2D.y[0] && target.y <= HEIGHT * ARENA_BOUNDS_2D.y[1])
  }
})

test('createTarget reads the cursor position lazily via getCursorPos on each respawn', () => {
  let cursor = { x: 100, y: 100 }
  const target = createTarget(WIDTH, HEIGHT, 'facil', () => cursor)
  const firstSpawn = { x: target.x, y: target.y }
  cursor = { x: 700, y: 500 }
  target.respawn()
  assert.ok(target.x !== firstSpawn.x || target.y !== firstSpawn.y)
  // Still near the NEW cursor position, within the max possible offset.
  const maxOffset = DIFFICULTIES.facil.distanceRangeFrac[1] * Math.min(WIDTH, HEIGHT) + 1
  assert.ok(Math.hypot(target.x - cursor.x, target.y - cursor.y) <= maxOffset
    || target.x === WIDTH * ARENA_BOUNDS_2D.x[1] || target.x === WIDTH * ARENA_BOUNDS_2D.x[0]
    || target.y === HEIGHT * ARENA_BOUNDS_2D.y[1] || target.y === HEIGHT * ARENA_BOUNDS_2D.y[0])
})
