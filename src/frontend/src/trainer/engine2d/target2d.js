// Generic 2D target primitive — the plain-{x,y} analogue of
// engine/clickTarget.js's ClickTarget, shared by every scenario2d module
// (continuous and click alike). No dispose() needed: nothing GPU-backed to
// free, unlike the old THREE.Mesh-backed target.
const SPAWN_ANIM_MS = 140
const HIT_FLASH_MS  = 160

export function easeOutCubic(t) {
  const c = Math.min(1, Math.max(0, t))
  return 1 - (1 - c) ** 3
}

// Slight overshoot then settle — a "pop" rather than a linear grow-in.
export function easeOutBack(t) {
  const c = Math.min(1, Math.max(0, t))
  const s = 1.70158
  return 1 + (s + 1) * (c - 1) ** 3 + s * (c - 1) ** 2
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay)
}

export class Target2D {
  constructor({ spawnPosition, radius, color = '#ff4757', glowColor = '#00d4ff' }) {
    this.spawnPosition = spawnPosition // () => {x, y}
    this.radius        = radius
    this.color         = color
    this.glowColor     = glowColor
    this.timeAliveMs   = 0
    this.hitFlashMs    = null

    const p = this.spawnPosition()
    this.x = p.x
    this.y = p.y
  }

  update(dtMs) {
    this.timeAliveMs += dtMs
    if (this.hitFlashMs != null) {
      this.hitFlashMs -= dtMs
      if (this.hitFlashMs <= 0) this.hitFlashMs = null
    }
  }

  respawn() {
    const p = this.spawnPosition()
    this.x = p.x
    this.y = p.y
    this.timeAliveMs = 0
  }

  // Triggers the brief hit-flash/pop animation without resetting position —
  // callers still call respawn() right after to move it to its next spot.
  flashHit() {
    this.hitFlashMs = HIT_FLASH_MS
  }

  containsPoint(px, py) {
    return distance(this.x, this.y, px, py) <= this.radius
  }

  draw(ctx) {
    const spawnScale = easeOutBack(this.timeAliveMs / SPAWN_ANIM_MS)
    const flashT      = this.hitFlashMs != null ? this.hitFlashMs / HIT_FLASH_MS : 0
    const r           = Math.max(0, this.radius * spawnScale * (1 + flashT * 0.4))

    ctx.save()
    ctx.shadowColor = this.glowColor
    ctx.shadowBlur  = 18
    ctx.fillStyle   = flashT > 0 ? '#ffffff' : this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
