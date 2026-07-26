import test from 'node:test'
import assert from 'node:assert/strict'
import { DrillSession, createDrillSession } from './drillSession.js'
import { distance } from './target2d.js'

const W = 100
const H = 100
const CENTER = { x: W / 2, y: H / 2 }

// A minimal fake catalog entry — same shape trainer/catalog.js DRILLS
// entries have (id/category/params), just with only 'medio' populated
// since these tests always run at that difficulty.
function makeDrill(category, params) {
  return { id: 'test_drill', category, params: { facil: params, medio: params, dificil: params } }
}

function cursorAt(pos) {
  return () => pos
}

// ── Continuous mode (tracking) ───────────────────────────────────────────

test('continuous mode hover-scores while the cursor sits on the target', () => {
  const drill = makeDrill('tracking', { radiusFrac: 0.1, speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1 })
  let cursor = { x: 0, y: 0 }
  const session = new DrillSession(drill, 'medio', W, H, () => cursor)
  session.target.x = 50
  session.target.y = 50 // radius = 0.1 * 100 = 10

  cursor = { x: 50, y: 50 }
  const first = session.update(16)
  assert.equal(first.enteredTarget, true, 'first frame on target counts as an entry')
  assert.equal(session.hud.score, 16)

  const second = session.update(16)
  assert.equal(second.enteredTarget, false, 'staying on target is not a new entry')
  assert.equal(session.hud.score, 32)
  assert.equal(session.hud.streak, 32)

  cursor = { x: 0, y: 0 }
  session.update(16)
  assert.equal(session.hud.streak, 0, 'leaving the target resets the current streak')
  assert.equal(session.hud.score, 32, 'score (total on-target ms) does not decrease')
})

test('continuous mode click() is a no-op', () => {
  const drill = makeDrill('tracking', { radiusFrac: 0.1, speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1 })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  assert.deepEqual(session.click({ x: 0, y: 0 }), { hit: false })
})

test('continuous mode result carries bestStreakMs and no avgReactionMs', () => {
  const drill = makeDrill('tracking', { radiusFrac: 0.1, speedFrac: 0, turnInterval: [1000, 1000], turnRate: 1 })
  let cursor = { x: 50, y: 50 }
  const session = new DrillSession(drill, 'medio', W, H, () => cursor)
  session.target.x = 50
  session.target.y = 50
  session.update(100)
  assert.equal(session.result.mode, 'continuous')
  assert.equal(session.result.bestStreakMs, 100)
  assert.equal(session.result.avgReactionMs, 0)
})

// ── Click mode: spawn strategies ─────────────────────────────────────────

test('spawn "center" always places the target at the canvas center', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: null, spawn: 'center' })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  for (let i = 0; i < 3; i++) {
    assert.equal(session.slots[0].target.x, W / 2)
    assert.equal(session.slots[0].target.y, H / 2)
    session.click({ x: W / 2, y: H / 2 }) // hit -> respawns
  }
})

test('spawn "duo" strictly alternates between the two fixed posts', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: null, spawn: 'duo' })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const posts = new Set()
  const seen = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = session.slots[0].target
    posts.add(`${x},${y}`)
    seen.push(x)
    session.click({ x, y })
  }
  assert.equal(posts.size, 2, 'only ever the two configured posts')
  assert.notEqual(seen[0], seen[1])
  assert.notEqual(seen[1], seen[2])
  assert.equal(seen[0], seen[2], 'alternation returns to the first post every other spawn')
})

test('spawn "grid" only uses configured cells and never repeats the same cell twice in a row', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: null, spawn: 'grid', grid: { cols: 2, rows: 1 } })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  let last = null
  for (let i = 0; i < 10; i++) {
    const { x, y } = session.slots[0].target
    const key = `${x},${y}`
    assert.notEqual(key, last, 'no immediate repeat of the same grid cell')
    last = key
    session.click({ x, y })
  }
})

test('spawn "chain" spawns the next target near the last hit, not near the cursor', () => {
  const drill = makeDrill('flicking', {
    radiusFrac: 0.05, timeoutMs: null, spawn: 'chain', distanceRangeFrac: [0.02, 0.03],
  })
  const cursor = { x: 5, y: 5 } // far corner — chain spawns should ignore this after the first hit
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(cursor))

  const first = session.slots[0].target
  session.click({ x: first.x, y: first.y }) // hit -> sets chainAnchor to the hit position
  const second = session.slots[0].target

  const distFromCursor = distance(second.x, second.y, cursor.x, cursor.y)
  const distFromLastHit = distance(second.x, second.y, first.x, first.y)
  assert.ok(distFromLastHit < distFromCursor, 'next spawn should hug the previous hit, not the cursor')
})

test('spawn "nearCursor" with alternate flips sides on each respawn (pendulum)', () => {
  const drill = makeDrill('flicking', {
    radiusFrac: 0.05, timeoutMs: null, spawn: 'nearCursor', distanceRangeFrac: [0.2, 0.25], alternate: true,
  })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const sides = []
  for (let i = 0; i < 4; i++) {
    const { x } = session.slots[0].target
    sides.push(Math.sign(x - CENTER.x))
    session.click({ x: session.slots[0].target.x, y: session.slots[0].target.y })
  }
  assert.notEqual(sides[0], sides[1])
  assert.notEqual(sides[1], sides[2])
  assert.equal(sides[0], sides[2], 'sides alternate strictly, back and forth')
})

// ── Click mode: decoys and no-go targets ──────────────────────────────────

test('decoy: hitting the decoy counts as a miss and removes only the decoy', (t) => {
  // Force the target and decoy to opposite sides of the cursor (theta 0 vs
  // PI) so they can never overlap — spawn order is [r_target, theta_target,
  // r_decoy, theta_decoy], each a Math.random() call.
  const sequence = [0, 0, 0, 0.5]
  let i = 0
  t.mock.method(Math, 'random', () => sequence[i++] ?? 0)

  const drill = makeDrill('flicking', {
    radiusFrac: 0.05, timeoutMs: null, spawn: 'nearCursor', distanceRangeFrac: [0.15, 0.2], decoy: true,
  })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const decoy = session.slots[0].decoy
  assert.ok(decoy, 'a decoy should be spawned alongside the real target')

  const result = session.click({ x: decoy.x, y: decoy.y })
  assert.equal(result.hit, false)
  assert.equal(session.hud.score, 0)
  assert.equal(session.slots[0].decoy, null, 'the decoy is cleared')
  assert.ok(session.slots[0].target, 'the real target stays alive — only the decoy was spent')
})

test('noGoChance=1: every target is a no-go — clicking it is a miss AND retires the slot', () => {
  const drill = makeDrill('reaction', { radiusFrac: 0.05, timeoutMs: null, spawn: 'random', noGoChance: 1 })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  assert.equal(session.slots[0].noGo, true)

  const target = session.slots[0].target
  const posBefore = { x: target.x, y: target.y }
  const result = session.click({ x: target.x, y: target.y })

  assert.equal(result.hit, false)
  assert.equal(session.hud.score, 0)
  assert.ok(session.slots[0].target, 'a new target should have respawned into the slot')
  assert.notDeepEqual({ x: session.slots[0].target.x, y: session.slots[0].target.y }, posBefore)
})

// ── Click mode: shrink / jump / rings / timeout ───────────────────────────

test('shrink: target scale shrinks from 1 toward minScale over its lifetime, then holds', () => {
  const drill = makeDrill('precision', {
    radiusFrac: 0.05, timeoutMs: 5000, spawn: 'center', shrink: { fromMs: 100, overMs: 400, minScale: 0.2 },
  })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const target = session.slots[0].target

  session.update(100) // still at fromMs -> full size
  assert.equal(target.scale, 1)

  session.update(200) // halfway through the shrink window (timeAliveMs = 300, t = 200/400 = 0.5)
  assert.ok(Math.abs(target.scale - (1 - 0.5 * 0.8)) < 1e-9)

  session.update(1000) // well past overMs -> clamped at minScale
  assert.ok(Math.abs(target.scale - 0.2) < 1e-9)
})

test('jump: the target relocates exactly once after afterMs, without resetting timeAliveMs', () => {
  const drill = makeDrill('precision', {
    radiusFrac: 0.05, timeoutMs: 5000, spawn: 'center', jump: { afterMs: 100, distanceFrac: 0.2 },
  })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const target = session.slots[0].target
  const origin = { x: target.x, y: target.y }

  session.update(50)
  assert.equal(target.x, origin.x, 'no jump before afterMs')
  assert.equal(target.timeAliveMs, 50)

  session.update(60) // crosses afterMs (timeAliveMs = 110)
  const jumpedDist = distance(target.x, target.y, origin.x, origin.y)
  assert.ok(Math.abs(jumpedDist - 0.2 * Math.min(W, H)) < 1e-6, 'jump distance matches distanceFrac * minDim')
  assert.equal(target.timeAliveMs, 110, 'jump does not reset timeAliveMs (still a reaction-time correction)')

  const afterFirstJump = { x: target.x, y: target.y }
  session.update(500) // long past afterMs — must not jump again
  assert.equal(target.x, afterFirstJump.x)
  assert.equal(target.y, afterFirstJump.y)
})

test('rings: a click near center scores innerPoints, further out scores outerPoints', () => {
  const drill = makeDrill('precision', {
    radiusFrac: 0.1, timeoutMs: null, spawn: 'center', rings: { innerFrac: 0.4, innerPoints: 2, outerPoints: 1 },
  })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const target = session.slots[0].target // radius = 10

  session.click({ x: target.x + 2, y: target.y }) // within the inner ring (0.4 * 10 = 4)
  assert.equal(session.hud.score, 2)

  const target2 = session.slots[0].target // respawned at center again
  session.click({ x: target2.x + 8, y: target2.y }) // inside the target but outside the inner ring
  assert.equal(session.hud.score, 3)
})

test('timeoutMs: an unhit target expires without registering a miss', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: 200, spawn: 'random' })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const before = { x: session.slots[0].target.x, y: session.slots[0].target.y }

  session.update(250) // past timeoutMs

  assert.equal(session.hud.score, 0)
  assert.equal(session.scorer.shotsFired, 0, 'an unhit expiry is never counted as a shot/miss')
  const after = session.slots[0].target
  assert.ok(after, 'a fresh target should have respawned')
  assert.notDeepEqual({ x: after.x, y: after.y }, before)
})

// ── Click mode: simultaneous targets, spawn delay, hit/miss bookkeeping ──

test('simultaneous: N independent slots are alive at once', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: null, spawn: 'random', simultaneous: 3 })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  assert.equal(session.slots.length, 3)
  assert.ok(session.slots.every((s) => s.target))
})

test('spawnDelayMs: a slot stays empty until its delay elapses', () => {
  const drill = makeDrill('reaction', { radiusFrac: 0.05, timeoutMs: 1000, spawn: 'center', spawnDelayMs: [100, 100] })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  assert.equal(session.slots[0].target, null, 'no target until the delay elapses')

  session.update(50)
  assert.equal(session.slots[0].target, null)

  session.update(60) // crosses the 100ms delay
  assert.ok(session.slots[0].target)
})

test('click() hit updates chainAnchor and retires the slot with a fresh respawn', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: null, spawn: 'random' })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const target = session.slots[0].target
  const result = session.click({ x: target.x, y: target.y })

  assert.equal(result.hit, true)
  assert.deepEqual(session.chainAnchor, { x: target.x, y: target.y })
  assert.equal(session.hud.score, 1)
})

test('click() on empty space registers a miss with zero reaction time', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: null, spawn: 'center' })
  const session = new DrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  const result = session.click({ x: -1000, y: -1000 }) // nowhere near the target
  assert.equal(result.hit, false)
  assert.equal(session.scorer.shotsFired, 1)
  assert.equal(session.hud.score, 0)
})

test('createDrillSession returns a working DrillSession instance', () => {
  const drill = makeDrill('clicking', { radiusFrac: 0.05, timeoutMs: null, spawn: 'center' })
  const session = createDrillSession(drill, 'medio', W, H, cursorAt(CENTER))
  assert.ok(session instanceof DrillSession)
  assert.equal(session.mode, 'click')
})
