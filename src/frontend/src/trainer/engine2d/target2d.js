// Generic 2D target primitive — the plain-{x,y} analogue of
// engine/clickTarget.js's ClickTarget, shared by every drill mechanic
// (continuous and click alike). No dispose() needed: nothing GPU-backed to
// free, unlike the old THREE.Mesh-backed target.
//
// Everything beyond the plain circle (ellipse aspect, live radius scale for
// shrinking targets, bullseye ring, avoid/no-go variant) is an OPTIONAL
// parameter with a no-op default, so the pre-3.1.0 drills render and
// hit-test byte-identically to before.
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
  constructor({
    spawnPosition, radius, color = '#ff4757', glowColor = '#00d4ff',
    aspectX = 1, aspectY = 1, ringFrac = null,
  }) {
    this.spawnPosition = spawnPosition // () => {x, y}
    this.radius        = radius
    this.color         = color
    this.glowColor     = glowColor
    this.aspectX       = aspectX
    this.aspectY       = aspectY
    this.ringFrac      = ringFrac // 0..1 → draw an inner ring at that radius fraction
    this.scale         = 1       // live multiplier (shrinking targets) — set by the session per frame
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
    this.scale = 1
  }

  // Relocates WITHOUT resetting timeAliveMs — used by the jump-correction
  // drill, where reaction time keeps counting from the original appearance.
  moveTo(x, y) {
    this.x = x
    this.y = y
  }

  // Triggers the brief hit-flash/pop animation without resetting position —
  // callers still call respawn() right after to move it to its next spot.
  flashHit() {
    this.hitFlashMs = HIT_FLASH_MS
  }

  containsPoint(px, py) {
    const r = this.radius * this.scale
    if (r <= 0) return false
    const nx = (px - this.x) / (r * this.aspectX)
    const ny = (py - this.y) / (r * this.aspectY)
    return nx * nx + ny * ny <= 1
  }

  // Distance from center normalized to the (scaled, aspect-corrected)
  // radius: 0 = dead center, 1 = edge. Used for ring scoring.
  normalizedDistance(px, py) {
    const r = this.radius * this.scale
    if (r <= 0) return Infinity
    const nx = (px - this.x) / (r * this.aspectX)
    const ny = (py - this.y) / (r * this.aspectY)
    return Math.hypot(nx, ny)
  }

  draw(ctx) {
    const spawnScale = easeOutBack(this.timeAliveMs / SPAWN_ANIM_MS)
    const flashT      = this.hitFlashMs != null ? this.hitFlashMs / HIT_FLASH_MS : 0
    const r           = Math.max(0, this.radius * this.scale * spawnScale * (1 + flashT * 0.4))

    ctx.save()
    ctx.shadowColor = this.glowColor
    ctx.shadowBlur  = 18
    ctx.fillStyle   = flashT > 0 ? '#ffffff' : this.color
    ctx.beginPath()
    ctx.ellipse(this.x, this.y, r * this.aspectX, r * this.aspectY, 0, 0, Math.PI * 2)
    ctx.fill()

    if (this.ringFrac != null && flashT === 0) {
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(8, 8, 16, 0.55)'
      ctx.lineWidth = Math.max(1.5, r * 0.06)
      ctx.beginPath()
      ctx.ellipse(this.x, this.y, r * this.ringFrac * this.aspectX, r * this.ringFrac * this.aspectY, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }
}
