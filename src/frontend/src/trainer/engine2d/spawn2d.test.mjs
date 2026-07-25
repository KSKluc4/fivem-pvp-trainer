import test from 'node:test'
import assert from 'node:assert/strict'
import { ARENA_BOUNDS_2D, clampToArenaBounds2D, randomPointInBounds2D, pointNearCursor2D } from './spawn2d.js'

const WIDTH = 800
const HEIGHT = 600

function inBounds(p) {
  return p.x >= WIDTH * ARENA_BOUNDS_2D.x[0] && p.x <= WIDTH * ARENA_BOUNDS_2D.x[1]
      && p.y >= HEIGHT * ARENA_BOUNDS_2D.y[0] && p.y <= HEIGHT * ARENA_BOUNDS_2D.y[1]
}

test('clampToArenaBounds2D pulls an out-of-bounds point back to the nearest edge', () => {
  const p = clampToArenaBounds2D(99999, -99999, WIDTH, HEIGHT)
  assert.equal(p.x, WIDTH * ARENA_BOUNDS_2D.x[1])
  assert.equal(p.y, HEIGHT * ARENA_BOUNDS_2D.y[0])
})

test('clampToArenaBounds2D leaves an already-valid point untouched', () => {
  const p = clampToArenaBounds2D(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
  assert.equal(p.x, WIDTH / 2)
  assert.equal(p.y, HEIGHT / 2)
})

test('randomPointInBounds2D always lands inside ARENA_BOUNDS_2D', () => {
  for (let i = 0; i < 200; i++) {
    assert.ok(inBounds(randomPointInBounds2D(WIDTH, HEIGHT)))
  }
})

test('pointNearCursor2D always lands inside ARENA_BOUNDS_2D regardless of cursor position', () => {
  for (let i = 0; i < 200; i++) {
    const cursor = { x: Math.random() * WIDTH, y: Math.random() * HEIGHT }
    const p = pointNearCursor2D(cursor, [0.05, 0.2], WIDTH, HEIGHT)
    assert.ok(inBounds(p), `point out of bounds: ${JSON.stringify(p)}`)
  }
})

test('pointNearCursor2D moves further from the cursor as distanceRangeFrac grows', () => {
  const cursor = { x: WIDTH / 2, y: HEIGHT / 2 }
  // Averaged over many samples (both are randomized angle+radius) — the
  // far range should produce a larger mean distance from the cursor than
  // the near range, well clear of clamping since the cursor is centered.
  function meanDistance(range) {
    let total = 0
    const n = 200
    for (let i = 0; i < n; i++) {
      const p = pointNearCursor2D(cursor, range, WIDTH, HEIGHT)
      total += Math.hypot(p.x - cursor.x, p.y - cursor.y)
    }
    return total / n
  }
  assert.ok(meanDistance([0.02, 0.03]) < meanDistance([0.15, 0.2]))
})
