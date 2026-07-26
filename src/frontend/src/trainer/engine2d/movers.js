import { randRange } from '../engine/spawn.js'

// Movement driver for the tracking mechanic — the generalized version of
// what used to live inside scenarios2d/tracking2d.js's TrackingTarget2D.
// One implementation, parameterized by the catalog (see catalog.js):
//   turnInterval/turnRate  how often/how sharply the heading changes
//   snapTurns              true → heading changes instantly (erratic drills)
//   pauseEvery/pauseFor    sudden full stops (stop-and-go drills)
// With snapTurns/pauses unset, the motion is byte-equivalent to the original
// Tracking Suave drift (blend toward a new heading on a random clock).
//
// `marginX`/`marginY` bound where the target may drift to, in PIXELS — the
// caller (DrillSession) derives them from the target's own radius (times
// its aspect multiplier) plus a slack constant, never a fixed universal
// fraction of the canvas. This is what keeps the target fully inside the
// visible/clickable field regardless of how big that drill's target is.

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

export class TrackingMover {
  // `target` is a Target2D; `cfg` is one difficulty's params from the catalog.
  constructor(target, cfg, width, height, marginX, marginY) {
    this.target  = target
    this.cfg     = cfg
    this.width   = width
    this.height  = height
    this.marginX = marginX
    this.marginY = marginY

    const minDim = Math.min(width, height)
    this.speed = cfg.speedFrac * minDim

    this.direction  = randomDirection()
    this.turnTarget = this.direction
    this.nextTurnIn = randRange(cfg.turnInterval)

    this.paused      = false
    this.pauseTimer  = cfg.pauseEvery ? randRange(cfg.pauseEvery) : null
  }

  update(dtS) {
    // Sudden full stops — the pause clock only exists when the catalog asks
    // for it (pauseEvery/pauseFor), other drills never enter this branch.
    if (this.pauseTimer != null) {
      this.pauseTimer -= dtS
      if (this.pauseTimer <= 0) {
        this.paused = !this.paused
        this.pauseTimer = randRange(this.paused ? this.cfg.pauseFor : this.cfg.pauseEvery)
      }
      if (this.paused) return
    }

    this.nextTurnIn -= dtS
    if (this.nextTurnIn <= 0) {
      this.turnTarget = randomDirection()
      this.nextTurnIn = randRange(this.cfg.turnInterval)
      if (this.cfg.snapTurns) this.direction = this.turnTarget
    }
    if (!this.cfg.snapTurns) {
      // Blend toward the new heading instead of snapping — keeps the path fluid.
      this.direction = lerpDirection(this.direction, this.turnTarget, Math.min(1, dtS * this.cfg.turnRate))
    }

    this.target.x += this.direction.x * this.speed * dtS
    this.target.y += this.direction.y * this.speed * dtS
    this._bounce()
  }

  _bounce() {
    const xMin = this.marginX
    const xMax = Math.max(xMin, this.width  - this.marginX)
    const yMin = this.marginY
    const yMax = Math.max(yMin, this.height - this.marginY)
    if (this.target.x < xMin) { this.target.x = xMin; this.direction.x *= -1 }
    if (this.target.x > xMax) { this.target.x = xMax; this.direction.x *= -1 }
    if (this.target.y < yMin) { this.target.y = yMin; this.direction.y *= -1 }
    if (this.target.y > yMax) { this.target.y = yMax; this.direction.y *= -1 }
  }

  // Called by DrillSession when the canvas itself resizes (window resize,
  // sidebar collapse/expand) — updates speed/margins for the new dimensions
  // without touching direction/turn/pause state, so the drift continues
  // smoothly instead of restarting.
  resize(newWidth, newHeight, marginX, marginY) {
    this.width   = newWidth
    this.height  = newHeight
    this.marginX = marginX
    this.marginY = marginY
    this.speed   = this.cfg.speedFrac * Math.min(newWidth, newHeight)
  }
}
