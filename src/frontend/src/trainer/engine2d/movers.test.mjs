import test from 'node:test'
import assert from 'node:assert/strict'
import { TrackingMover } from './movers.js'
import { Target2D } from './target2d.js'

function fixedTarget(x, y) {
  return new Target2D({ spawnPosition: () => ({ x, y }), radius: 5 })
}

test('without snapTurns, direction blends toward the turn target instead of snapping', () => {
  const target = fixedTarget(50, 50) // well inside ARENA_BOUNDS_2D for a 100x100 canvas
  const mover  = new TrackingMover(target, { speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1 }, 100, 100)
  mover.direction  = { x: 1, y: 0 }
  mover.turnTarget = { x: 0, y: 1 }
  mover.nextTurnIn = 1000 // far from elapsing — isolates the blend step

  mover.update(0.5) // t = min(1, dtS * turnRate) = 0.5

  assert.ok(Math.abs(mover.direction.x - mover.direction.y) < 1e-9, 'halfway blend should be symmetric')
  assert.ok(mover.direction.x > 0 && mover.direction.x < 1, 'should have moved partway, not snapped')
})

test('with snapTurns, direction jumps instantly to the new heading once nextTurnIn elapses', (t) => {
  t.mock.method(Math, 'random', () => 0.25) // randomDirection() -> angle = PI/2 -> (~0, 1)
  const target = fixedTarget(50, 50) // well inside ARENA_BOUNDS_2D for a 100x100 canvas
  const mover  = new TrackingMover(target, { speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1, snapTurns: true }, 100, 100)
  mover.direction  = { x: 1, y: 0 }
  mover.turnTarget = { x: 1, y: 0 }
  mover.nextTurnIn = 0.1

  mover.update(0.2) // dtS > nextTurnIn -> triggers a turn

  assert.ok(Math.abs(mover.direction.x) < 1e-9)
  assert.ok(Math.abs(mover.direction.y - 1) < 1e-9)
})

test('pauseEvery/pauseFor: the target stops moving entirely during a pause window', () => {
  const target = fixedTarget(50, 50) // well inside ARENA_BOUNDS_2D for a 100x100 canvas
  const mover = new TrackingMover(
    target,
    { speedFrac: 1, turnInterval: [1000, 1000], turnRate: 1, pauseEvery: [0.1, 0.1], pauseFor: [0.5, 0.5] },
    100, 100,
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

test('bounces off the arena edge and reverses that axis of direction', () => {
  const width = 100
  const height = 100
  const target = fixedTarget(width * 0.94, 50) // sitting exactly at the right edge
  const mover  = new TrackingMover(target, { speedFrac: 1, turnInterval: [1000, 1000], turnRate: 1 }, width, height)
  mover.direction  = { x: 1, y: 0 } // heading further right, into the wall
  mover.turnTarget = { x: 1, y: 0 }
  mover.nextTurnIn = 1000

  mover.update(1)

  assert.equal(target.x, width * 0.94, 'clamped back to the arena edge')
  assert.equal(mover.direction.x, -1, 'x direction reversed on bounce')
})
