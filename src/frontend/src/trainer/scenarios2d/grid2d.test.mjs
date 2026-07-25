import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_ID, SESSION_DURATION_S, DIFFICULTIES, createTarget } from './grid2d.js'
import { ARENA_BOUNDS_2D } from '../engine2d/spawn2d.js'

const WIDTH = 800
const HEIGHT = 600

test('exercise metadata', () => {
  assert.equal(EXERCISE_ID, 'grid_2d')
  assert.equal(SESSION_DURATION_S, 60)
  assert.deepEqual(Object.keys(DIFFICULTIES), ['facil', 'medio', 'dificil'])
})

test('no timeout at any difficulty — hesitation is never punished', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    assert.equal(DIFFICULTIES[key].timeoutMs, null)
  }
})

test('radius shrinks as difficulty increases', () => {
  assert.ok(DIFFICULTIES.facil.radiusFrac > DIFFICULTIES.medio.radiusFrac)
  assert.ok(DIFFICULTIES.medio.radiusFrac > DIFFICULTIES.dificil.radiusFrac)
})

test('createTarget spawns anywhere in ARENA_BOUNDS_2D, independent of any cursor position', () => {
  for (let i = 0; i < 30; i++) {
    const target = createTarget(WIDTH, HEIGHT, 'dificil')
    assert.ok(target.x >= WIDTH * ARENA_BOUNDS_2D.x[0] && target.x <= WIDTH * ARENA_BOUNDS_2D.x[1])
    assert.ok(target.y >= HEIGHT * ARENA_BOUNDS_2D.y[0] && target.y <= HEIGHT * ARENA_BOUNDS_2D.y[1])
  }
})

test('respawn moves the target to a new position', () => {
  const target = createTarget(WIDTH, HEIGHT, 'medio')
  const { x, y } = target
  let moved = false
  for (let i = 0; i < 20; i++) {
    target.respawn()
    if (target.x !== x || target.y !== y) { moved = true; break }
  }
  assert.ok(moved, 'respawn should eventually land at a different position')
})
