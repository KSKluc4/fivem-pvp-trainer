import test from 'node:test'
import assert from 'node:assert/strict'
import { createCursorTracker } from './cursor2d.js'

// A minimal stand-in for an HTMLCanvasElement — just enough surface
// (addEventListener/removeEventListener/getBoundingClientRect) for
// createCursorTracker's pure position-tracking logic, no real DOM/jsdom
// needed (this repo has none configured).
function fakeCanvas(rect = { left: 0, top: 0, width: 400, height: 300 }) {
  const listeners = {}
  return {
    rect,
    addEventListener(type, fn) { listeners[type] = fn },
    removeEventListener(type, fn) { if (listeners[type] === fn) delete listeners[type] },
    getBoundingClientRect() { return this.rect },
    fireMove(clientX, clientY) { listeners.pointermove?.({ clientX, clientY }) },
    hasListener(type) { return !!listeners[type] },
  }
}

test('getPosition starts at (0,0) before any movement', () => {
  const tracker = createCursorTracker(fakeCanvas())
  assert.deepEqual(tracker.getPosition(), { x: 0, y: 0 })
})

test('attach starts tracking pointermove, detach stops it', () => {
  const canvas = fakeCanvas()
  const tracker = createCursorTracker(canvas)
  assert.ok(!canvas.hasListener('pointermove'))
  tracker.attach()
  assert.ok(canvas.hasListener('pointermove'))
  canvas.fireMove(120, 80)
  assert.deepEqual(tracker.getPosition(), { x: 120, y: 80 })
  tracker.detach()
  assert.ok(!canvas.hasListener('pointermove'))
})

test('position is translated relative to the canvas rect', () => {
  const canvas = fakeCanvas({ left: 50, top: 20, width: 400, height: 300 })
  const tracker = createCursorTracker(canvas)
  tracker.attach()
  canvas.fireMove(150, 120)
  assert.deepEqual(tracker.getPosition(), { x: 100, y: 100 })
})

test('position is clamped to the canvas bounds', () => {
  const canvas = fakeCanvas({ left: 0, top: 0, width: 400, height: 300 })
  const tracker = createCursorTracker(canvas)
  tracker.attach()
  canvas.fireMove(-50, -50)
  assert.deepEqual(tracker.getPosition(), { x: 0, y: 0 })
  canvas.fireMove(9999, 9999)
  assert.deepEqual(tracker.getPosition(), { x: 400, y: 300 })
})
