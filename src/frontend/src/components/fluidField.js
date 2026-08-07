// Fluid-particle flow field — the simulation behind AppBackground.
//
// Deliberately DOM-free: everything here works against plain numbers and a
// CanvasRenderingContext2D-shaped object, so the whole thing (including the
// pause logic, which is the part that must never regress) is unit-testable
// under `node --test` with a stub context — see fluidField.test.mjs.
//
// The motion is a classic flow field: a Perlin noise value at the particle's
// position becomes an angle, the particle walks along that angle, wraps at the
// edges, and fades in/out over its own lifetime. The "fluid" look comes from
// the trail: instead of clearing the canvas each frame we paint a
// semitransparent slab of the page background over it, so previous positions
// decay into streaks.

const PERM_SIZE = 256
const TAU = Math.PI * 2

// ─── Seedable PRNG ──────────────────────────────────────────────────────────
// Lets tests build a bit-for-bit reproducible field. Production passes nothing
// and gets Math.random.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Perlin noise (classic permutation-table implementation, 2D) ────────────
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerp(a, b, t) { return a + t * (b - a) }

// 4 gradient directions is plenty for a decorative field and avoids a lookup
// table — the visual difference against the 8/12-gradient variants is nil at
// this scale.
function grad(hash, x, y) {
  switch (hash & 3) {
    case 0:  return  x + y
    case 1:  return -x + y
    case 2:  return  x - y
    default: return -x - y
  }
}

export function createPerlin(random = Math.random) {
  const p = new Uint8Array(PERM_SIZE)
  for (let i = 0; i < PERM_SIZE; i++) p[i] = i
  for (let i = PERM_SIZE - 1; i > 0; i--) {          // Fisher–Yates
    const j = Math.floor(random() * (i + 1))
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp
  }
  // Doubled so the +1 neighbour lookups below never need a modulo.
  const perm = new Uint8Array(PERM_SIZE * 2)
  for (let i = 0; i < PERM_SIZE * 2; i++) perm[i] = p[i & (PERM_SIZE - 1)]

  return function noise2D(x, y) {
    const fx = Math.floor(x)
    const fy = Math.floor(y)
    const xi = fx & 255
    const yi = fy & 255
    const xf = x - fx
    const yf = y - fy
    const u = fade(xf)
    const v = fade(yf)
    const aa = perm[perm[xi]     + yi]
    const ab = perm[perm[xi]     + yi + 1]
    const ba = perm[perm[xi + 1] + yi]
    const bb = perm[perm[xi + 1] + yi + 1]
    const x1 = lerp(grad(aa, xf, yf),     grad(ba, xf - 1, yf),     u)
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u)
    return lerp(x1, x2, v)                            // ≈ [-1, 1]
  }
}

// ─── Tuning ─────────────────────────────────────────────────────────────────
// Particle counts are a density (one particle per N CSS px² of window) with a
// hard ceiling, not a fixed number — a small window must not pay for a big
// one's budget, and a 4K window must not blow past the ceiling. Both modes sit
// an order of magnitude below the 2000-particle reference implementation;
// trails do the visual work, so a sparse field still reads as dense.
export const INTENSITY = {
  // Auth screens (login/register/forgot) — nothing else is animating there.
  full: {
    pixelsPerParticle: 7000,
    minParticles: 70,
    maxParticles: 300,
    trailAlpha:     0.13,   // page-bg slab painted each frame → trail length
    particleAlpha:  0.50,   // peak alpha at mid-life
    layerOpacity:   1,      // CSS opacity of the whole canvas
    speed:          26,     // CSS px / second
    noiseScale:     0.0016, // world px → noise space
    noiseDrift:     0.030,  // noise-space units / second (field evolution)
    minLife:        4,
    maxLife:        11,
    purpleShare:    0.42,   // fraction of particles on the secondary color
  },
  // Every internal screen — fewer particles, dimmer, so cards and body text
  // keep their contrast.
  subtle: {
    pixelsPerParticle: 18000,
    minParticles: 30,
    maxParticles: 130,
    trailAlpha:     0.17,
    particleAlpha:  0.34,
    layerOpacity:   0.55,
    speed:          20,
    noiseScale:     0.0014,
    noiseDrift:     0.022,
    minLife:        5,
    maxLife:        13,
    purpleShare:    0.42,
  },
}

// Fallback colors — the real ones come from the theme at runtime (AppBackground
// reads --color-primary/--color-secondary/--bg-primary off :root, which is
// where theme.js's brandCyan/brandPurple/dark palette lands in index.css).
export const DEFAULT_COLORS = {
  primary:    '#00d4ff',
  secondary:  '#7b2fd4',
  background: '#080810',
}

export function intensityConfig(intensity) {
  return INTENSITY[intensity] || INTENSITY.subtle
}

export function particleCountFor(width, height, intensity) {
  const cfg = intensityConfig(intensity)
  const area = Math.max(0, width) * Math.max(0, height)
  const raw = Math.round(area / cfg.pixelsPerParticle)
  return Math.max(cfg.minParticles, Math.min(cfg.maxParticles, raw))
}

// ─── Canvas sizing ──────────────────────────────────────────────────────────
// Two independent ceilings: never render above 1.5× device pixels (a 4K
// display would otherwise quadruple the per-frame fill cost for a blurry
// decorative layer nobody inspects at 1:1), and never exceed a total
// backing-store budget regardless of how the window is sized.
export const MAX_DPR = 1.5
export const MAX_BACKING_PIXELS = 2_400_000   // ≈ 2000 × 1200

export function backingScaleFor(width, height, dpr) {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  let scale = Math.min(safeDpr, MAX_DPR)
  const area = Math.max(1, width) * Math.max(1, height)
  const budget = Math.sqrt(MAX_BACKING_PIXELS / area)
  if (scale > budget) scale = budget
  return Math.max(0.5, scale)
}

// ─── Color helpers ──────────────────────────────────────────────────────────
export function hexToRgb(hex) {
  const raw = String(hex || '').trim().replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const n = Number.parseInt(full, 16)
  if (full.length !== 6 || Number.isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgba(hex, alpha) {
  const c = hexToRgb(hex) || hexToRgb(DEFAULT_COLORS.background)
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

// ─── The field ──────────────────────────────────────────────────────────────
export function createFluidField({
  width,
  height,
  intensity = 'subtle',
  colors = DEFAULT_COLORS,
  random = Math.random,
} = {}) {
  const cfg = intensityConfig(intensity)
  const noise = createPerlin(random)
  const palette = [
    colors.primary   || DEFAULT_COLORS.primary,
    colors.secondary || DEFAULT_COLORS.secondary,
  ]
  const bg = colors.background || DEFAULT_COLORS.background
  const trailFill = rgba(bg, cfg.trailAlpha)
  const solidFill = rgba(bg, 1)

  let w = Math.max(1, width)
  let h = Math.max(1, height)
  let particles = []
  let drift = 0

  function reset(p, i, count, seeded) {
    p.x = random() * w
    p.y = random() * h
    p.maxLife = cfg.minLife + random() * (cfg.maxLife - cfg.minLife)
    // On (re)build, stagger lifetimes so the whole field doesn't blink in and
    // out in unison; on respawn a particle starts its cycle from zero.
    p.life = seeded ? random() * p.maxLife : 0
    p.size = 1 + random() * 0.9
    // Color index is assigned by position in the array (not randomly) so the
    // array stays sorted by color — paint() then needs exactly one fillStyle
    // change per frame instead of one per particle.
    p.color = i < Math.round(count * (1 - cfg.purpleShare)) ? 0 : 1
    return p
  }

  function build() {
    const count = particleCountFor(w, h, intensity)
    particles = new Array(count)
    for (let i = 0; i < count; i++) particles[i] = reset({}, i, count, true)
  }

  build()

  function step(dtMs) {
    const dt = dtMs / 1000
    // The field itself scrolls through noise space over time, which is what
    // makes the flow evolve instead of freezing into fixed streamlines.
    drift += cfg.noiseDrift * dt
    const travel = cfg.speed * dt
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const angle = noise(p.x * cfg.noiseScale, p.y * cfg.noiseScale + drift) * TAU
      p.x += Math.cos(angle) * travel
      p.y += Math.sin(angle) * travel
      p.life += dt
      if (p.life >= p.maxLife) {
        // reset() re-derives the color from the index, so the array stays
        // sorted by color across respawns.
        reset(p, i, particles.length, false)
        continue
      }
      // Wrap
      if (p.x < 0) p.x += w; else if (p.x >= w) p.x -= w
      if (p.y < 0) p.y += h; else if (p.y >= h) p.y -= h
    }
  }

  function paint(ctx) {
    ctx.globalAlpha = 1
    ctx.fillStyle = trailFill
    ctx.fillRect(0, 0, w, h)

    let currentColor = -1
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      // sin() over the lifetime → fades in from nothing and back out again.
      const a = Math.sin((p.life / p.maxLife) * Math.PI)
      if (a <= 0.02) continue
      if (p.color !== currentColor) {
        currentColor = p.color
        ctx.fillStyle = palette[currentColor]
      }
      ctx.globalAlpha = a * cfg.particleAlpha
      ctx.fillRect(p.x, p.y, p.size, p.size)
    }
    ctx.globalAlpha = 1
  }

  // Setting canvas.width/height wipes the bitmap to transparent, so callers
  // must repaint an opaque base after every resize — otherwise the trail slab
  // composites over nothing and the first frames flash through to the page.
  function fillBase(ctx) {
    ctx.globalAlpha = 1
    ctx.fillStyle = solidFill
    ctx.fillRect(0, 0, w, h)
  }

  function resize(nextW, nextH) {
    w = Math.max(1, nextW)
    h = Math.max(1, nextH)
    build()
  }

  return {
    step,
    paint,
    fillBase,
    resize,
    get width() { return w },
    get height() { return h },
    get count() { return particles.length },
    get particles() { return particles },
  }
}

// ─── Pause policy ───────────────────────────────────────────────────────────
// One predicate, one source of truth. Every listener in AppBackground feeds
// this and then calls a single reconcile function — four independent
// start/stop callers is how you end up with two concurrent rAF loops after an
// unlucky blur/focus interleave.
export function shouldAnimate({ focused, visible, trainerActive, reducedMotion }) {
  return Boolean(focused) && Boolean(visible) && !trainerActive && !reducedMotion
}

export const TARGET_FPS = 30

// ─── Frame loop ─────────────────────────────────────────────────────────────
// rAF still fires at the display's rate (up to 144Hz here), so the loop uses a
// time accumulator and only does work once ~1/30s of simulated time has piled
// up. Everything injectable so tests can drive it with a fake clock.
export function createBackgroundLoop({
  raf,
  caf,
  now,
  onFrame,
  fps = TARGET_FPS,
}) {
  const interval = 1000 / fps
  let rafId = null
  let last = 0
  let acc = 0

  function tick() {
    rafId = raf(tick)
    const t = now()
    let dt = t - last
    last = t
    // A long gap means the loop was throttled (background tab) or the machine
    // stalled — advance one nominal frame instead of fast-forwarding the
    // simulation through the whole gap.
    if (dt > 250 || dt < 0) dt = interval
    acc += dt
    if (acc < interval) return
    const simulated = Math.min(acc, interval * 3)
    acc = 0
    onFrame(simulated)
  }

  return {
    start() {
      if (rafId !== null) return
      last = now()
      acc = interval          // render the first frame immediately
      rafId = raf(tick)
    },
    stop() {
      if (rafId === null) return
      caf(rafId)
      rafId = null
    },
    get running() { return rafId !== null },
  }
}
