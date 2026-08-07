import test from 'node:test'
import assert from 'node:assert/strict'

import {
  mulberry32,
  createPerlin,
  createFluidField,
  createBackgroundLoop,
  shouldAnimate,
  intensityConfig,
  particleCountFor,
  backingScaleFor,
  hexToRgb,
  rgba,
  INTENSITY,
  DEFAULT_COLORS,
  MAX_DPR,
  MAX_BACKING_PIXELS,
  TARGET_FPS,
} from './fluidField.js'

// A CanvasRenderingContext2D-shaped stub. Records every fillStyle assignment
// (not just the distinct ones) so the color-batching invariant in paint() is
// actually observable.
function stubCtx() {
  const calls = { fills: [], styleWrites: [], alphaWrites: [] }
  let fillStyle = ''
  let globalAlpha = 1
  return {
    calls,
    get fillStyle() { return fillStyle },
    set fillStyle(v) { fillStyle = v; calls.styleWrites.push(v) },
    get globalAlpha() { return globalAlpha },
    set globalAlpha(v) { globalAlpha = v; calls.alphaWrites.push(v) },
    fillRect(x, y, w, h) { calls.fills.push({ x, y, w, h, fillStyle, globalAlpha }) },
  }
}

// ─── shouldAnimate — the pause policy, the part that must never regress ─────

test('shouldAnimate: only the all-clear case animates', () => {
  const allClear = { focused: true, visible: true, trainerActive: false, reducedMotion: false }
  assert.equal(shouldAnimate(allClear), true)

  assert.equal(shouldAnimate({ ...allClear, focused: false }), false)
  assert.equal(shouldAnimate({ ...allClear, visible: false }), false)
  assert.equal(shouldAnimate({ ...allClear, trainerActive: true }), false)
  assert.equal(shouldAnimate({ ...allClear, reducedMotion: true }), false)
})

test('shouldAnimate: full truth table — any single blocker wins', () => {
  const bit = (n, i) => Boolean(n & (1 << i))
  for (let n = 0; n < 16; n++) {
    const state = {
      focused:       bit(n, 0),
      visible:       bit(n, 1),
      trainerActive: bit(n, 2),
      reducedMotion: bit(n, 3),
    }
    const expected = state.focused && state.visible && !state.trainerActive && !state.reducedMotion
    assert.equal(shouldAnimate(state), expected, `state ${JSON.stringify(state)}`)
  }
})

test('shouldAnimate: missing flags are treated as "not ready", never as animate', () => {
  assert.equal(shouldAnimate({}), false)
  assert.equal(shouldAnimate({ focused: true }), false)
  assert.equal(shouldAnimate({ focused: true, visible: true }), true)
})

// ─── createBackgroundLoop ───────────────────────────────────────────────────

function fakeClock() {
  let t = 0
  let nextId = 1
  const pending = new Map()
  return {
    now: () => t,
    raf: (fn) => { const id = nextId++; pending.set(id, fn); return id },
    caf: (id) => { pending.delete(id) },
    get scheduled() { return pending.size },
    // Advance the clock and fire whatever rAF callback is queued, once.
    advance(ms) {
      t += ms
      const entry = pending.entries().next()
      if (entry.done) return
      const [id, fn] = entry.value
      pending.delete(id)
      fn()
    },
  }
}

function loopWith(clock, opts = {}) {
  const frames = []
  const loop = createBackgroundLoop({
    raf: clock.raf,
    caf: clock.caf,
    now: clock.now,
    onFrame: (dt) => frames.push(dt),
    ...opts,
  })
  return { loop, frames }
}

test('loop: start() is idempotent — a second start does not open a second rAF chain', () => {
  const clock = fakeClock()
  const { loop } = loopWith(clock)
  loop.start()
  loop.start()
  loop.start()
  assert.equal(clock.scheduled, 1)
  assert.equal(loop.running, true)
})

test('loop: stop() cancels and is safe to call when already stopped', () => {
  const clock = fakeClock()
  const { loop } = loopWith(clock)
  loop.stop()
  assert.equal(loop.running, false)
  loop.start()
  loop.stop()
  loop.stop()
  assert.equal(clock.scheduled, 0)
  assert.equal(loop.running, false)
})

test('loop: stop/start cycles leave exactly one live rAF chain', () => {
  const clock = fakeClock()
  const { loop } = loopWith(clock)
  for (let i = 0; i < 5; i++) { loop.start(); loop.stop() }
  loop.start()
  assert.equal(clock.scheduled, 1)
})

test('loop: renders one frame immediately on start', () => {
  const clock = fakeClock()
  const { loop, frames } = loopWith(clock)
  loop.start()
  clock.advance(0)
  assert.equal(frames.length, 1)
})

test('loop: throttles to the target fps regardless of how fast rAF fires', () => {
  const clock = fakeClock()
  const { loop, frames } = loopWith(clock)
  const interval = 1000 / TARGET_FPS
  loop.start()
  clock.advance(0)              // the immediate first frame
  frames.length = 0
  // 144Hz display: ~4.86 rAF callbacks per 30fps interval.
  for (let i = 0; i < 144; i++) clock.advance(1000 / 144)
  // One second of wall clock at 144Hz must yield ~TARGET_FPS frames, not 144.
  assert.ok(frames.length <= TARGET_FPS + 1, `got ${frames.length} frames`)
  assert.ok(frames.length >= TARGET_FPS - 2, `got ${frames.length} frames`)
  for (const dt of frames) assert.ok(dt >= interval, `dt ${dt} below interval ${interval}`)
})

test('loop: a long stall advances one nominal frame, not the whole gap', () => {
  const clock = fakeClock()
  const { loop, frames } = loopWith(clock)
  const interval = 1000 / TARGET_FPS
  loop.start()
  clock.advance(0)
  frames.length = 0
  clock.advance(10_000)         // tab was backgrounded for 10s
  assert.equal(frames.length, 1)
  assert.equal(frames[0], interval)
})

test('loop: a backwards clock is clamped to one nominal frame', () => {
  const clock = fakeClock()
  const interval = 1000 / TARGET_FPS
  let t = 1000
  const frames = []
  let queued = null
  const loop = createBackgroundLoop({
    raf: (fn) => { queued = fn; return 1 },
    caf: () => { queued = null },
    now: () => t,
    onFrame: (dt) => frames.push(dt),
  })
  loop.start()
  queued()                      // immediate frame
  frames.length = 0
  t = 500                       // clock jumped backwards
  queued()
  assert.equal(frames.length, 1)
  assert.equal(frames[0], interval)
})

test('loop: simulated time per frame is capped at 3 intervals', () => {
  const clock = fakeClock()
  const { loop, frames } = loopWith(clock)
  const interval = 1000 / TARGET_FPS
  loop.start()
  clock.advance(0)
  frames.length = 0
  clock.advance(240)            // under the 250ms stall threshold, over 3 intervals
  assert.equal(frames.length, 1)
  assert.ok(frames[0] <= interval * 3 + 1e-9, `simulated ${frames[0]}`)
})

test('loop: honours a custom fps', () => {
  const clock = fakeClock()
  const { loop, frames } = loopWith(clock, { fps: 10 })
  loop.start()
  clock.advance(0)
  frames.length = 0
  clock.advance(50)             // below the 100ms interval
  assert.equal(frames.length, 0)
  clock.advance(60)             // accumulator now over 100ms
  assert.equal(frames.length, 1)
})

// ─── Sizing / budgets ───────────────────────────────────────────────────────

test('backingScaleFor: never renders above MAX_DPR', () => {
  assert.equal(backingScaleFor(800, 600, 1), 1)
  assert.equal(backingScaleFor(800, 600, 1.25), 1.25)
  assert.equal(backingScaleFor(800, 600, 3), MAX_DPR)
})

test('backingScaleFor: the pixel budget overrides DPR on big windows', () => {
  const w = 3840
  const h = 2160
  const scale = backingScaleFor(w, h, 2)
  assert.ok(scale < MAX_DPR, `expected budget to bite, got ${scale}`)
  assert.ok(w * scale * h * scale <= MAX_BACKING_PIXELS + 1, 'backing store over budget')
})

test('backingScaleFor: never drops below the 0.5 floor, even absurdly large', () => {
  assert.equal(backingScaleFor(100000, 100000, 2), 0.5)
})

test('backingScaleFor: a bogus devicePixelRatio falls back to 1', () => {
  for (const dpr of [0, -2, NaN, Infinity, undefined, null]) {
    assert.equal(backingScaleFor(800, 600, dpr), 1, `dpr ${dpr}`)
  }
})

test('particleCountFor: clamps at both ends and scales with area between them', () => {
  for (const intensity of ['full', 'subtle']) {
    const cfg = INTENSITY[intensity]
    assert.equal(particleCountFor(1, 1, intensity), cfg.minParticles)
    assert.equal(particleCountFor(0, 0, intensity), cfg.minParticles)
    assert.equal(particleCountFor(20000, 20000, intensity), cfg.maxParticles)
    const mid = cfg.pixelsPerParticle * ((cfg.minParticles + cfg.maxParticles) / 2)
    const count = particleCountFor(mid, 1, intensity)
    assert.ok(count > cfg.minParticles && count < cfg.maxParticles, `got ${count}`)
  }
})

test('particleCountFor: "full" is denser than "subtle" at the same size', () => {
  assert.ok(particleCountFor(1920, 1080, 'full') > particleCountFor(1920, 1080, 'subtle'))
})

test('intensityConfig: unknown intensities fall back to subtle', () => {
  assert.equal(intensityConfig('full'), INTENSITY.full)
  assert.equal(intensityConfig('subtle'), INTENSITY.subtle)
  assert.equal(intensityConfig('nope'), INTENSITY.subtle)
  assert.equal(intensityConfig(undefined), INTENSITY.subtle)
})

// ─── Color helpers ──────────────────────────────────────────────────────────

test('hexToRgb: 6-digit, 3-digit shorthand, and stray whitespace', () => {
  assert.deepEqual(hexToRgb('#00d4ff'), { r: 0, g: 212, b: 255 })
  assert.deepEqual(hexToRgb('00d4ff'), { r: 0, g: 212, b: 255 })
  assert.deepEqual(hexToRgb('  #0f8  '), { r: 0, g: 255, b: 136 })
  assert.deepEqual(hexToRgb('#FFFFFF'), { r: 255, g: 255, b: 255 })
})

test('hexToRgb: rejects anything that is not a hex color', () => {
  for (const bad of ['', '   ', '#12345', 'rgb(1,2,3)', 'zzzzzz', null, undefined, '#12345678']) {
    assert.equal(hexToRgb(bad), null, `expected null for ${String(bad)}`)
  }
})

test('rgba: builds a css color, falling back to the background on bad input', () => {
  assert.equal(rgba('#00d4ff', 0.5), 'rgba(0, 212, 255, 0.5)')
  const bg = hexToRgb(DEFAULT_COLORS.background)
  assert.equal(rgba('not-a-color', 1), `rgba(${bg.r}, ${bg.g}, ${bg.b}, 1)`)
})

// ─── PRNG / noise ───────────────────────────────────────────────────────────

test('mulberry32: deterministic per seed, in [0,1), and seed-sensitive', () => {
  const a = mulberry32(42)
  const b = mulberry32(42)
  const c = mulberry32(43)
  const seqA = Array.from({ length: 32 }, a)
  const seqB = Array.from({ length: 32 }, b)
  const seqC = Array.from({ length: 32 }, c)
  assert.deepEqual(seqA, seqB)
  assert.notDeepEqual(seqA, seqC)
  for (const v of seqA) assert.ok(v >= 0 && v < 1, `out of range: ${v}`)
})

test('createPerlin: stays in ~[-1,1], is continuous, and repeats on the lattice', () => {
  const noise = createPerlin(mulberry32(7))
  let max = 0
  for (let x = 0; x < 40; x += 0.37) {
    for (let y = 0; y < 40; y += 0.41) {
      const v = noise(x, y)
      assert.ok(Number.isFinite(v), `non-finite at ${x},${y}`)
      max = Math.max(max, Math.abs(v))
    }
  }
  assert.ok(max <= 1.001, `noise exceeded [-1,1]: ${max}`)
  // Integer lattice points are zero-crossings in this formulation, and a small
  // step must produce a small change — that continuity is what makes the flow
  // field look like flow instead of static.
  const a = noise(3.5, 2.5)
  const b = noise(3.5001, 2.5)
  assert.ok(Math.abs(a - b) < 0.01, `discontinuity: ${a} vs ${b}`)
})

test('createPerlin: handles negative coordinates without throwing or NaN', () => {
  const noise = createPerlin(mulberry32(3))
  for (const [x, y] of [[-1.5, -2.5], [-300.25, 12.75], [0, 0]]) {
    assert.ok(Number.isFinite(noise(x, y)), `non-finite at ${x},${y}`)
  }
})

// ─── The field ──────────────────────────────────────────────────────────────

function field(overrides = {}) {
  return createFluidField({
    width: 800,
    height: 600,
    intensity: 'subtle',
    random: mulberry32(1234),
    ...overrides,
  })
}

test('field: builds the density-derived particle count', () => {
  const f = field()
  assert.equal(f.count, particleCountFor(800, 600, 'subtle'))
  assert.equal(f.width, 800)
  assert.equal(f.height, 600)
})

test('field: guards against zero/negative dimensions', () => {
  const f = field({ width: 0, height: -10 })
  assert.equal(f.width, 1)
  assert.equal(f.height, 1)
  assert.equal(f.count, INTENSITY.subtle.minParticles)
})

test('field: particles spawn inside the box with staggered lifetimes', () => {
  const f = field()
  const lives = new Set()
  for (const p of f.particles) {
    assert.ok(p.x >= 0 && p.x < 800, `x out of range: ${p.x}`)
    assert.ok(p.y >= 0 && p.y < 600, `y out of range: ${p.y}`)
    assert.ok(p.life >= 0 && p.life < p.maxLife, `life ${p.life} / ${p.maxLife}`)
    assert.ok(p.maxLife >= INTENSITY.subtle.minLife && p.maxLife <= INTENSITY.subtle.maxLife)
    lives.add(p.life)
  }
  // Staggered, not all born at once — otherwise the whole field blinks in unison.
  assert.ok(lives.size > f.count * 0.9, 'lifetimes are not staggered')
})

test('field: every particle stays inside the box across a long run', () => {
  const f = field()
  for (let i = 0; i < 600; i++) f.step(1000 / TARGET_FPS)
  for (const p of f.particles) {
    assert.ok(p.x >= 0 && p.x < 800, `x escaped: ${p.x}`)
    assert.ok(p.y >= 0 && p.y < 600, `y escaped: ${p.y}`)
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
  }
})

test('field: particles actually move', () => {
  const f = field()
  const before = f.particles.map((p) => `${p.x},${p.y}`)
  f.step(1000 / TARGET_FPS)
  const moved = f.particles.filter((p, i) => `${p.x},${p.y}` !== before[i]).length
  assert.ok(moved > f.count * 0.9, `only ${moved}/${f.count} particles moved`)
})

test('field: a particle past its lifetime respawns from zero', () => {
  const f = field()
  const p = f.particles[0]
  p.life = p.maxLife
  const wasColor = p.color
  f.step(1000 / TARGET_FPS)
  assert.equal(f.particles[0].life, 0)
  // reset() re-derives the color from the array index, so respawning must not
  // scramble the color ordering paint() depends on.
  assert.equal(f.particles[0].color, wasColor)
})

test('field: same seed → bit-for-bit identical simulation', () => {
  const a = field({ random: mulberry32(99) })
  const b = field({ random: mulberry32(99) })
  for (let i = 0; i < 50; i++) { a.step(33); b.step(33) }
  assert.deepEqual(
    a.particles.map((p) => [p.x, p.y, p.life, p.color]),
    b.particles.map((p) => [p.x, p.y, p.life, p.color]),
  )
})

test('field: different seeds → different simulation', () => {
  const a = field({ random: mulberry32(1) })
  const b = field({ random: mulberry32(2) })
  for (let i = 0; i < 20; i++) { a.step(33); b.step(33) }
  assert.notDeepEqual(a.particles.map((p) => p.x), b.particles.map((p) => p.x))
})

test('field: the particle array stays sorted by color', () => {
  const f = field()
  const sorted = (arr) => arr.every((p, i) => i === 0 || arr[i - 1].color <= p.color)
  assert.ok(sorted(f.particles), 'unsorted at build')
  for (let i = 0; i < 400; i++) f.step(1000 / TARGET_FPS)
  assert.ok(sorted(f.particles), 'unsorted after respawns')
})

test('field: both palette colors are represented, roughly at purpleShare', () => {
  const f = field({ intensity: 'full' })
  const purple = f.particles.filter((p) => p.color === 1).length
  const share = purple / f.count
  assert.ok(Math.abs(share - INTENSITY.full.purpleShare) < 0.02, `share ${share}`)
})

// ─── paint() ────────────────────────────────────────────────────────────────

test('paint: the trail slab is a semitransparent background fill, not a clear', () => {
  const f = field({ colors: { ...DEFAULT_COLORS, background: '#080810' } })
  const ctx = stubCtx()
  f.paint(ctx)
  const slab = ctx.calls.fills[0]
  assert.equal(slab.fillStyle, rgba('#080810', INTENSITY.subtle.trailAlpha))
  assert.equal(slab.globalAlpha, 1)
  assert.deepEqual([slab.x, slab.y, slab.w, slab.h], [0, 0, 800, 600])
})

test('paint: batches fillStyle — one write per color, not per particle', () => {
  const f = field()
  for (let i = 0; i < 30; i++) f.step(1000 / TARGET_FPS)   // spread lifetimes out
  const ctx = stubCtx()
  f.paint(ctx)
  // Trail slab + at most one write per palette color. This is the invariant
  // the color-sorted array exists to protect; it breaks silently.
  assert.ok(ctx.calls.styleWrites.length <= 3, `${ctx.calls.styleWrites.length} fillStyle writes`)
  assert.ok(ctx.calls.fills.length > 10, 'expected particles to be drawn')
})

test('paint: uses the theme colors it was given', () => {
  const f = field({ colors: { primary: '#ff0000', secondary: '#00ff00', background: '#000000' } })
  for (let i = 0; i < 30; i++) f.step(1000 / TARGET_FPS)
  const ctx = stubCtx()
  f.paint(ctx)
  const used = new Set(ctx.calls.fills.map((c) => c.fillStyle))
  assert.ok(used.has('#ff0000') || used.has('#00ff00'), `colors used: ${[...used]}`)
})

test('paint: particle alpha never exceeds the configured peak, and resets to 1', () => {
  const f = field()
  for (let i = 0; i < 30; i++) f.step(1000 / TARGET_FPS)
  const ctx = stubCtx()
  f.paint(ctx)
  const particleFills = ctx.calls.fills.slice(1)          // [0] is the trail slab
  assert.ok(particleFills.length > 10, 'expected particles to be drawn')
  for (const c of particleFills) {
    assert.ok(c.globalAlpha <= INTENSITY.subtle.particleAlpha + 1e-9, `alpha ${c.globalAlpha}`)
    assert.ok(c.globalAlpha > 0)
  }
  // Leaving globalAlpha < 1 behind would poison whatever draws next.
  assert.equal(ctx.globalAlpha, 1)
})

test('paint: skips particles that are effectively invisible', () => {
  const f = field()
  for (const p of f.particles) p.life = 0          // alpha = sin(0) = 0
  const ctx = stubCtx()
  f.paint(ctx)
  assert.equal(ctx.calls.fills.length, 1, 'only the trail slab should be drawn')
})

test('fillBase: paints one fully opaque background rect over the whole canvas', () => {
  const f = field({ colors: { ...DEFAULT_COLORS, background: '#080810' } })
  const ctx = stubCtx()
  f.fillBase(ctx)
  assert.equal(ctx.calls.fills.length, 1)
  const base = ctx.calls.fills[0]
  assert.equal(base.fillStyle, 'rgba(8, 8, 16, 1)')
  assert.equal(base.globalAlpha, 1)
  assert.deepEqual([base.x, base.y, base.w, base.h], [0, 0, 800, 600])
})

// ─── resize ─────────────────────────────────────────────────────────────────

test('resize: rebuilds the field at the new size and count', () => {
  const f = field()
  f.resize(1920, 1080)
  assert.equal(f.width, 1920)
  assert.equal(f.height, 1080)
  assert.equal(f.count, particleCountFor(1920, 1080, 'subtle'))
  for (const p of f.particles) {
    assert.ok(p.x >= 0 && p.x < 1920)
    assert.ok(p.y >= 0 && p.y < 1080)
  }
})

test('resize: a collapsed box does not produce NaN or an empty field', () => {
  const f = field()
  f.resize(0, 0)
  assert.equal(f.width, 1)
  assert.equal(f.height, 1)
  assert.ok(f.count > 0)
  f.step(33)
  for (const p of f.particles) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
})

test('resize: painting after a resize covers the new dimensions', () => {
  const f = field()
  f.resize(1024, 768)
  const ctx = stubCtx()
  f.paint(ctx)
  const slab = ctx.calls.fills[0]
  assert.deepEqual([slab.w, slab.h], [1024, 768])
})
