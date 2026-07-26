import test from 'node:test'
import assert from 'node:assert/strict'
import { Target2D, easeOutCubic, easeOutBack, distance } from './target2d.js'

function fixedSpawn(x, y) {
  return () => ({ x, y })
}

test('distance is the plain Euclidean distance between two points', () => {
  assert.equal(distance(0, 0, 3, 4), 5)
  assert.equal(distance(1, 1, 1, 1), 0)
})

test('easeOutCubic goes from 0 to 1 and is clamped outside [0,1]', () => {
  assert.equal(easeOutCubic(0), 0)
  assert.equal(easeOutCubic(1), 1)
  assert.equal(easeOutCubic(-5), 0)
  assert.equal(easeOutCubic(5), 1)
  assert.ok(easeOutCubic(0.5) > 0 && easeOutCubic(0.5) < 1)
})

test('easeOutBack settles at 1 and is clamped outside [0,1]', () => {
  assert.ok(Math.abs(easeOutBack(0)) < 1e-9)
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9)
  assert.ok(Math.abs(easeOutBack(-5)) < 1e-9)
})

test('Target2D spawns at spawnPosition()', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(10, 20), radius: 5 })
  assert.equal(target.x, 10)
  assert.equal(target.y, 20)
  assert.equal(target.timeAliveMs, 0)
})

test('containsPoint is true within radius, false outside it', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(100, 100), radius: 10 })
  assert.ok(target.containsPoint(100, 100))
  assert.ok(target.containsPoint(105, 100))
  assert.ok(!target.containsPoint(200, 200))
})

test('update accumulates timeAliveMs and decays an active hit flash', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(0, 0), radius: 5 })
  target.update(100)
  assert.equal(target.timeAliveMs, 100)
  target.flashHit()
  assert.ok(target.hitFlashMs > 0)
  target.update(10000)
  assert.equal(target.hitFlashMs, null)
})

test('respawn moves to a new spawnPosition() and resets timeAliveMs', () => {
  let call = 0
  const positions = [{ x: 0, y: 0 }, { x: 50, y: 60 }]
  const target = new Target2D({ spawnPosition: () => positions[call++], radius: 5 })
  target.update(500)
  target.respawn()
  assert.equal(target.x, 50)
  assert.equal(target.y, 60)
  assert.equal(target.timeAliveMs, 0)
})

test('containsPoint shrinks the hitbox as scale shrinks (precisao_minguante_2d)', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(100, 100), radius: 10 })
  target.scale = 0.5
  assert.ok(!target.containsPoint(107, 100))  // inside the full radius, outside the shrunk one
  assert.ok(target.containsPoint(104, 100))   // inside the shrunk radius
})

test('a scale of 0 has no hitbox at all', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(100, 100), radius: 10 })
  target.scale = 0
  assert.ok(!target.containsPoint(100, 100))
})

test('respawn resets scale back to 1', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(0, 0), radius: 10 })
  target.scale = 0.3
  target.respawn()
  assert.equal(target.scale, 1)
})

test('containsPoint stretches the hitbox by aspectX/aspectY (precisao_fresta_2d)', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(100, 100), radius: 10, aspectX: 0.3, aspectY: 1.35 })
  // Narrow on X: a point inside a circular radius-10 target falls outside
  // the ellipse once it's squeezed horizontally.
  assert.ok(!target.containsPoint(107, 100))
  assert.ok(target.containsPoint(102, 100))
  // Tall on Y: further vertically than the base radius but still inside the
  // stretched ellipse.
  assert.ok(target.containsPoint(100, 113))
})

test('normalizedDistance is 0 at center, 1 at the (scaled) edge — used for ring scoring', () => {
  const target = new Target2D({ spawnPosition: fixedSpawn(100, 100), radius: 10 })
  assert.equal(target.normalizedDistance(100, 100), 0)
  assert.ok(Math.abs(target.normalizedDistance(110, 100) - 1) < 1e-9)
  target.scale = 0.5
  assert.ok(Math.abs(target.normalizedDistance(105, 100) - 1) < 1e-9)
})
