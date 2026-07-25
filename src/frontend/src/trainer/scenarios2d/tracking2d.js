import { randRange } from '../engine/spawn.js'
import { ARENA_BOUNDS_2D } from '../engine2d/spawn2d.js'
import { Target2D } from '../engine2d/target2d.js'
import { DRILL_ACCENTS, TARGET_COLOR } from '../engine2d/theme2d.js'

// "Tracking Suave" (2D) — a single target drifting through fluid,
// pseudo-random direction changes on the flat canvas plane. New key
// (tracking_2d) — scores on a different scale than the old 3D drill
// (tracking_suave), so old records stay untouched/orphaned in the DB.
export const EXERCISE_ID = 'tracking_2d'
export const SESSION_DURATION_S = 60

// speedFrac/radiusFrac are fractions of min(canvasWidth, canvasHeight) —
// resolution-independent, mirrors the old drill's world-unit tuning ratios.
export const DIFFICULTIES = {
  facil:   { radiusFrac: 0.055, speedFrac: 0.20, turnInterval: [1.3, 2.2], turnRate: 1.2 },
  medio:   { radiusFrac: 0.042, speedFrac: 0.32, turnInterval: [0.9, 1.6], turnRate: 1.6 },
  dificil: { radiusFrac: 0.032, speedFrac: 0.46, turnInterval: [0.6, 1.1], turnRate: 2.2 },
}

function randomDirection() {
  const angle = Math.random() * Math.PI * 2
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y)
  return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 1, y: 0 }
}

function lerpDirection(a, b, t) {
  return normalize({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
}

export class TrackingTarget2D {
  constructor(width, height, difficultyKey = 'medio') {
    this.difficulty = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
    this.width  = width
    this.height = height

    const minDim = Math.min(width, height)
    this.radius  = this.difficulty.radiusFrac * minDim
    this.speed   = this.difficulty.speedFrac * minDim

    const start = {
      x: randRange([width * ARENA_BOUNDS_2D.x[0], width * ARENA_BOUNDS_2D.x[1]]),
      y: randRange([height * ARENA_BOUNDS_2D.y[0], height * ARENA_BOUNDS_2D.y[1]]),
    }
    this.target = new Target2D({
      spawnPosition: () => start,
      radius: this.radius,
      color: TARGET_COLOR,
      glowColor: DRILL_ACCENTS.tracking_2d,
    })

    this.direction  = randomDirection()
    this.turnTarget = this.direction
    this.nextTurnIn = randRange(this.difficulty.turnInterval)
  }

  get x() { return this.target.x }
  get y() { return this.target.y }
  get timeAliveMs() { return this.target.timeAliveMs }

  update(dt) {
    this.target.update(dt * 1000)

    this.nextTurnIn -= dt
    if (this.nextTurnIn <= 0) {
      this.turnTarget = randomDirection()
      this.nextTurnIn = randRange(this.difficulty.turnInterval)
    }
    // Blend toward the new heading instead of snapping — keeps the path fluid.
    this.direction = lerpDirection(this.direction, this.turnTarget, Math.min(1, dt * this.difficulty.turnRate))

    this.target.x += this.direction.x * this.speed * dt
    this.target.y += this.direction.y * this.speed * dt
    this._bounce()
  }

  _bounce() {
    const xMin = this.width  * ARENA_BOUNDS_2D.x[0]
    const xMax = this.width  * ARENA_BOUNDS_2D.x[1]
    const yMin = this.height * ARENA_BOUNDS_2D.y[0]
    const yMax = this.height * ARENA_BOUNDS_2D.y[1]
    if (this.target.x < xMin) { this.target.x = xMin; this.direction.x *= -1 }
    if (this.target.x > xMax) { this.target.x = xMax; this.direction.x *= -1 }
    if (this.target.y < yMin) { this.target.y = yMin; this.direction.y *= -1 }
    if (this.target.y > yMax) { this.target.y = yMax; this.direction.y *= -1 }
  }

  containsPoint(px, py) { return this.target.containsPoint(px, py) }
  draw(ctx) { this.target.draw(ctx) }
}

export function createTarget(width, height, difficultyKey = 'medio') {
  return new TrackingTarget2D(width, height, difficultyKey)
}

// Time-on-target scoring — ms spent with the cursor over the target,
// no click needed. A direct port of scenarios/trackingSmooth.js's
// TrackingScorer (that file stays frozen, still used by the sensitivity
// discovery flow) — duplicated here rather than imported to keep the "old
// 3D" vs "new 2D" module boundary clean for ~15 lines of pure ms math.
export class TrackingScorer {
  constructor() {
    this.onTargetMs      = 0
    this.totalMs         = 0
    this.currentStreakMs = 0
    this.bestStreakMs    = 0
    // Unused by this scorer — kept so a session result has the same shape
    // as ClickScorer2D's, letting ResultsScreen read either without
    // branching on which fields exist.
    this.avgReactionMs   = 0
  }

  update(dtMs, isOnTarget) {
    this.totalMs += dtMs
    if (isOnTarget) {
      this.onTargetMs += dtMs
      this.currentStreakMs += dtMs
      if (this.currentStreakMs > this.bestStreakMs) this.bestStreakMs = this.currentStreakMs
    } else {
      this.currentStreakMs = 0
    }
  }

  get score() {
    return Math.round(this.onTargetMs)
  }

  get accuracyPct() {
    return this.totalMs > 0 ? (this.onTargetMs / this.totalMs) * 100 : 0
  }
}

export { TrackingScorer as Scorer }
