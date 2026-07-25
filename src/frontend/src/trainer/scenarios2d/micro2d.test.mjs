import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_ID, SESSION_DURATION_S, DIFFICULTIES, createTarget } from './micro2d.js'
import { ARENA_BOUNDS_2D } from '../engine2d/spawn2d.js'

const WIDTH = 800
const HEIGHT = 600

test('exercise metadata', () => {
  assert.equal(EXERCISE_ID, 'micro_2d')
  assert.equal(SESSION_DURATION_S, 60)
  assert.deepEqual(Object.keys(DIFFICULTIES), ['facil', 'medio', 'dificil'])
})

test('BOTH radius and timeout shrink with difficulty (unlike Flick Rápido)', () => {
  assert.ok(DIFFICULTIES.facil.radiusFrac > DIFFICULTIES.medio.radiusFrac)
  assert.ok(DIFFICULTIES.medio.radiusFrac > DIFFICULTIES.dificil.radiusFrac)
  assert.ok(DIFFICULTIES.facil.timeoutMs > DIFFICULTIES.medio.timeoutMs)
  assert.ok(DIFFICULTIES.medio.timeoutMs > DIFFICULTIES.dificil.timeoutMs)
})

test('spawns much closer to the cursor than Flick Rápido would', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    assert.ok(DIFFICULTIES[key].distanceRangeFrac[1] <= 0.1)
  }
})

test('createTarget spawns inside ARENA_BOUNDS_2D near the cursor', () => {
  for (let i = 0; i < 30; i++) {
    const cursor = { x: Math.random() * WIDTH, y: Math.random() * HEIGHT }
    const target = createTarget(WIDTH, HEIGHT, 'dificil', () => cursor)
    assert.ok(target.x >= WIDTH * ARENA_BOUNDS_2D.x[0] && target.x <= WIDTH * ARENA_BOUNDS_2D.x[1])
    assert.ok(target.y >= HEIGHT * ARENA_BOUNDS_2D.y[0] && target.y <= HEIGHT * ARENA_BOUNDS_2D.y[1])
  }
})
