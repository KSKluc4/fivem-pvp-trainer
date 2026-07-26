import test from 'node:test'
import assert from 'node:assert/strict'
import { TrackingMover } from './movers.js'
import { Target2D } from './target2d.js'

const MARGIN = 6 // radius(5) + a bit of slack, for a 100x100 test canvas

function fixedTarget(x, y) {
  return new Target2D({ spawnPosition: () => ({ x, y }), radius: 5 })
}

test('without snapTurns, direction blends toward the turn target instead of snapping', () => {
  const target = fixedTarget(50, 50) // well inside the margin-safe field for a 100x100 canvas
  const mover  = new TrackingMover(target, { speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1 }, 100, 100, MARGIN, MARGIN)
  mover.direction  = { x: 1, y: 0 }
  mover.turnTarget = { x: 0, y: 1 }
  mover.nextTurnIn = 1000 // far from elapsing — isolates the blend step

  mover.update(0.5) // t = min(1, dtS * turnRate) = 0.5

  assert.ok(Math.abs(mover.direction.x - mover.direction.y) < 1e-9, 'halfway blend should be symmetric')
  assert.ok(mover.direction.x > 0 && mover.direction.x < 1, 'should have moved partway, not snapped')
})

test('with snapTurns, direction jumps instantly to the new heading once nextTurnIn elapses', (t) => {
  t.mock.method(Math, 'random', () => 0.25) // randomDirection() -> angle = PI/2 -> (~0, 1)
  const target = fixedTarget(50, 50)
  const mover  = new TrackingMover(target, { speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1, snapTurns: true }, 100, 100, MARGIN, MARGIN)
  mover.direction  = { x: 1, y: 0 }
  mover.turnTarget = { x: 1, y: 0 }
  mover.nextTurnIn = 0.1

  mover.update(0.2) // dtS > nextTurnIn -> triggers a turn

  assert.ok(Math.abs(mover.direction.x) < 1e-9)
  assert.ok(Math.abs(mover.direction.y - 1) < 1e-9)
})

test('pauseEvery/pauseFor: the target stops moving entirely during a pause window', () => {
  const target = fixedTarget(50, 50)
  const mover = new TrackingMover(
    target,
    { speedFrac: 1, turnInterval: [1000, 1000], turnRate: 1, pauseEvery: [0.1, 0.1], pauseFor: [0.5, 0.5] },
    100, 100, MARGIN, MARGIN,
  )
  mover.direction  = { x: 1, y: 0 }
  mover.turnTarget = { x: 1, y: 0 }
  mover.nextTurnIn = 1000

  mover.update(0.2) // crosses the 0.1 pauseEvery threshold -> enters the pause
  assert.equal(target.x, 50, 'no movement should happen once paused')
  assert.equal(mover.paused, true)

  mover.update(0.1) // still within the 0.5 pauseFor window
  assert.equal(target.x, 50)
  assert.equal(mover.paused, true)

  mover.update(0.5) // crosses pauseFor -> resumes and moves in the same call
  assert.equal(mover.paused, false)
  assert.ok(target.x > 50, 'movement should resume once the pause ends')
})

test('bounces off the field edge (margin, not the raw canvas edge) and reverses that axis', () => {
  const width = 100
  const height = 100
  const target = fixedTarget(width - MARGIN, 50) // sitting exactly at the right margin edge
  const mover  = new TrackingMover(target, { speedFrac: 1, turnInterval: [1000, 1000], turnRate: 1 }, width, height, MARGIN, MARGIN)
  mover.direction  = { x: 1, y: 0 } // heading further right, into the wall
  mover.turnTarget = { x: 1, y: 0 }
  mover.nextTurnIn = 1000

  mover.update(1)

  assert.equal(target.x, width - MARGIN, 'clamped back to the margin edge')
  assert.equal(mover.direction.x, -1, 'x direction reversed on bounce')
})

test('resize updates width/height/margins/speed without resetting direction or turn state', () => {
  const target = fixedTarget(50, 50)
  const mover  = new TrackingMover(target, { speedFrac: 0.5, turnInterval: [1000, 1000], turnRate: 1 }, 100, 100, MARGIN, MARGIN)
  mover.direction  = { x: 0.6, y: 0.8 }
  mover.turnTarget = { x: 0.6, y: 0.8 }
  mover.nextTurnIn = 42

  mover.resize(200, 200, 12, 12)

  assert.equal(mover.width, 200)
  assert.equal(mover.height, 200)
  assert.equal(mover.marginX, 12)
  assert.equal(mover.marginY, 12)
  assert.equal(mover.speed, 0.5 * 200) // recomputed from cfg.speedFrac * new minDim
  assert.deepEqual(mover.direction, { x: 0.6, y: 0.8 }) // motion continues smoothly
  assert.equal(mover.nextTurnIn, 42)
})

test('resize takes effect on the very next bounce check', () => {
  const target = fixedTarget(50, 50)
  const mover  = new TrackingMover(target, { speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1 }, 100, 100, MARGIN, MARGIN)
  mover.direction  = { x: 1, y: 0 }
  mover.turnTarget = { x: 1, y: 0 }
  mover.nextTurnIn = 1000

  mover.resize(100, 100, 40, 40) // a much bigger margin, simulating a bigger target after resize
  target.x = 65 // was safely inside the old MARGIN=6 field, now outside the new 40px margin
  mover.update(0.001) // speedFrac 0 -> no drift, isolates the bounce clamp itself

  assert.equal(target.x, 60) // clamped to width(100) - newMarginX(40)
})
