import test from 'node:test'
import assert from 'node:assert/strict'
import { clampToArenaBounds2D, randomPointInBounds2D, pointNearCursor2D } from './spawn2d.js'

const WIDTH = 800
const HEIGHT = 600
const MX = 40
const MY = 30

function inBounds(p, marginX = MX, marginY = MY) {
  return p.x >= marginX && p.x <= WIDTH - marginX
      && p.y >= marginY && p.y <= HEIGHT - marginY
}

test('clampToArenaBounds2D pulls an out-of-bounds point back to the margin edge', () => {
  const p = clampToArenaBounds2D(99999, -99999, WIDTH, HEIGHT, MX, MY)
  assert.equal(p.x, WIDTH - MX)
  assert.equal(p.y, MY)
})

test('clampToArenaBounds2D leaves an already-valid point untouched', () => {
  const p = clampToArenaBounds2D(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, MX, MY)
  assert.equal(p.x, WIDTH / 2)
  assert.equal(p.y, HEIGHT / 2)
})

test('clampToArenaBounds2D falls back to center instead of an inverted range when the margin exceeds half the canvas', () => {
  // A target bigger than the canvas itself (or a canvas resized below the
  // target's own size mid-session) must never produce min > max.
  const p = clampToArenaBounds2D(10, 10, 100, 100, 90, 90)
  assert.equal(p.x, 50)
  assert.equal(p.y, 50)
})

test('randomPointInBounds2D always lands inside the margin-safe field', () => {
  for (let i = 0; i < 200; i++) {
    assert.ok(inBounds(randomPointInBounds2D(WIDTH, HEIGHT, MX, MY)))
  }
})

test('pointNearCursor2D always lands inside the margin-safe field regardless of cursor position', () => {
  for (let i = 0; i < 200; i++) {
    // Cursor can be ANYWHERE, including outside the field entirely (edge of
    // the browser window) — the clamp must still hold.
    const cursor = { x: (Math.random() - 0.2) * WIDTH * 1.4, y: (Math.random() - 0.2) * HEIGHT * 1.4 }
    const p = pointNearCursor2D(cursor, [0.05, 0.2], WIDTH, HEIGHT, MX, MY)
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
      const p = pointNearCursor2D(cursor, range, WIDTH, HEIGHT, MX, MY)
      total += Math.hypot(p.x - cursor.x, p.y - cursor.y)
    }
    return total / n
  }
  assert.ok(meanDistance([0.02, 0.03]) < meanDistance([0.15, 0.2]))
})
