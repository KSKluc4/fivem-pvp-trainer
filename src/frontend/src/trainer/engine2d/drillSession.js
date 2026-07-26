import { randRange } from '../engine/spawn.js'
import { randomPointInBounds2D, pointNearCursor2D, clampToArenaBounds2D } from './spawn2d.js'
import { Target2D } from './target2d.js'
import { ClickScorer2D, TrackingScorer2D } from './clickScorer2d.js'
import { TrackingMover } from './movers.js'
import { TARGET_COLOR, AVOID_COLOR, AVOID_GLOW, CATEGORY_ACCENTS } from './theme2d.js'
import { modeOf } from '../catalog.js'

// Extra breathing room (px) beyond a target's own visual edge when computing
// how close it may spawn/drift to the field's edge — see marginX/marginY
// below. Purely cosmetic (keeps targets from looking glued to the border).
const EDGE_SLACK_PX = 6

// The one generic drill runtime — every catalog entry, old and new, runs
// through this class. It reads the entry's per-difficulty params (see the
// parameter reference in catalog.js) and drives targets, spawn logic,
// timeouts, decoys, go/no-go, shrinking, jumps and scoring accordingly.
// ExercisePlayer only ever talks to this interface:
//   update(dtMs)  -> { enteredTarget }   (moves/spawns/expires, scores hover)
//   click(pos)    -> { hit }             (no-op for continuous drills)
//   resize(w, h)  -> repositions/rescales everything already on screen
//   draw(ctx), hud, result
//
// Parity guarantee: for the 4 pre-3.1.0 drills the observable behavior
// (spawn rules, timeout handling, scoring, hit flash) is unchanged — their
// params exercise only the code paths the old per-drill modules had.
//
// Every spawn position is clamped to marginX/marginY of the CANVAS edge —
// never a fixed universal fraction — where marginX/marginY are the target's
// own (aspect-corrected) radius plus EDGE_SLACK_PX. This is the fix for the
// "target spawns partially under the HUD / off the field" bug: as long as
// the caller (ExercisePlayer) gives this class the size of the PLAYABLE
// FIELD ONLY (HUD lives outside that area entirely, not overlaid on top of
// it), every target is guaranteed fully visible and clickable.
export class DrillSession {
  constructor(drill, difficultyKey, width, height, getCursorPos) {
    this.drill  = drill
    this.cfg    = drill.params[difficultyKey] || drill.params.medio
    this.width  = width
    this.height = height
    this.getCursorPos = getCursorPos || (() => ({ x: width / 2, y: height / 2 }))
    this.mode   = modeOf(drill)
    this.accent = CATEGORY_ACCENTS[drill.category]
    this.aspectX = this.cfg.aspect?.x ?? 1
    this.aspectY = this.cfg.aspect?.y ?? 1

    this._recomputeSpatials(width, height)

    if (this.mode === 'continuous') {
      this.scorer = new TrackingScorer2D()
      this.target = this._makeTarget(() => randomPointInBounds2D(width, height, this.marginX, this.marginY))
      this.mover  = new TrackingMover(this.target, this.cfg, width, height, this.marginX, this.marginY)
      this.wasOnTarget = false
      return
    }

    this.scorer = new ClickScorer2D()
    this.chainAnchor  = null // last hit position — spawn origin for spawn:'chain'
    this.pendulumSide = Math.random() < 0.5 ? 1 : -1
    this.lastGridCell = -1
    this.duoIndex     = Math.random() < 0.5 ? 0 : 1

    if (this.cfg.spawn === 'grid') this.gridCells = this._buildGridCells(this.cfg.grid)
    if (this.cfg.spawn === 'duo')  this.duoPosts  = this._buildDuoPosts()

    // One slot per simultaneous target; each cycles spawn → live → retire.
    const count = this.cfg.simultaneous || 1
    this.slots = Array.from({ length: count }, () => this._freshSlot())
  }

  // radius/margins derive from radiusFrac * min(width,height) — recomputed
  // here (constructor AND resize) so the two never drift apart.
  _recomputeSpatials(width, height) {
    const minDim = Math.min(width, height)
    this.minDim  = minDim
    this.radius  = this.cfg.radiusFrac * minDim
    this.marginX = this.radius * this.aspectX + EDGE_SLACK_PX
    this.marginY = this.radius * this.aspectY + EDGE_SLACK_PX
  }

  _makeTarget(spawnPosition, { avoid = false } = {}) {
    return new Target2D({
      spawnPosition,
      radius:    this.radius,
      color:     avoid ? AVOID_COLOR : TARGET_COLOR,
      glowColor: avoid ? AVOID_GLOW : this.accent,
      aspectX:   this.aspectX,
      aspectY:   this.aspectY,
      ringFrac:  avoid ? null : (this.cfg.rings?.innerFrac ?? null),
    })
  }

  _buildGridCells({ cols, rows }) {
    const x0 = this.marginX, x1 = this.width  - this.marginX
    const y0 = this.marginY, y1 = this.height - this.marginY
    const cells = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({
          x: x0 + (x1 - x0) * ((c + 0.5) / cols),
          y: y0 + (y1 - y0) * ((r + 0.5) / rows),
        })
      }
    }
    return cells
  }

  _buildDuoPosts() {
    return [
      clampToArenaBounds2D(this.width * 0.30, this.height * 0.5, this.width, this.height, this.marginX, this.marginY),
      clampToArenaBounds2D(this.width * 0.70, this.height * 0.5, this.width, this.height, this.marginX, this.marginY),
    ]
  }

  _spawnPosition() {
    const cfg = this.cfg
    switch (cfg.spawn) {
      case 'nearCursor': {
        const cursor = this.getCursorPos()
        if (!cfg.alternate) return pointNearCursor2D(cursor, cfg.distanceRangeFrac, this.width, this.height, this.marginX, this.marginY)
        // Pendulum: strictly alternate sides, within ±45° of horizontal.
        const theta = (this.pendulumSide === 1 ? 0 : Math.PI) + (Math.random() - 0.5) * (Math.PI / 2)
        this.pendulumSide *= -1
        const r = randRange(cfg.distanceRangeFrac) * this.minDim
        return clampToArenaBounds2D(cursor.x + Math.cos(theta) * r, cursor.y + Math.sin(theta) * r, this.width, this.height, this.marginX, this.marginY)
      }
      case 'chain':
        return pointNearCursor2D(this.chainAnchor || this.getCursorPos(), cfg.distanceRangeFrac, this.width, this.height, this.marginX, this.marginY)
      case 'grid': {
        let idx = Math.floor(Math.random() * this.gridCells.length)
        if (this.gridCells.length > 1 && idx === this.lastGridCell) idx = (idx + 1) % this.gridCells.length
        this.lastGridCell = idx
        return this.gridCells[idx]
      }
      case 'duo':
        this.duoIndex = 1 - this.duoIndex
        return this.duoPosts[this.duoIndex]
      case 'center':
        return clampToArenaBounds2D(this.width * 0.5, this.height * 0.5, this.width, this.height, this.marginX, this.marginY)
      case 'random':
      default:
        return randomPointInBounds2D(this.width, this.height, this.marginX, this.marginY)
    }
  }

  _freshSlot() {
    const slot = { target: null, decoy: null, noGo: false, jumped: false, pendingMs: 0 }
    slot.pendingMs = this.cfg.spawnDelayMs ? randRange(this.cfg.spawnDelayMs) : 0
    if (slot.pendingMs <= 0) this._spawnIntoSlot(slot)
    return slot
  }

  _spawnIntoSlot(slot, { flash = false } = {}) {
    slot.noGo   = this.cfg.noGoChance ? Math.random() < this.cfg.noGoChance : false
    slot.jumped = false
    const pos = this._spawnPosition()
    slot.target = this._makeTarget(() => pos, { avoid: slot.noGo })
    // Visual parity with the old per-drill modules: on an instant respawn
    // the hit flash plays on the newly spawned target.
    if (flash) slot.target.flashHit()
    if (this.cfg.decoy && !slot.noGo) {
      const decoyPos = pointNearCursor2D(this.getCursorPos(), this.cfg.distanceRangeFrac, this.width, this.height, this.marginX, this.marginY)
      slot.decoy = this._makeTarget(() => decoyPos, { avoid: true })
    } else {
      slot.decoy = null
    }
  }

  _retireSlot(slot, { flash = false } = {}) {
    slot.target = null
    slot.decoy  = null
    slot.pendingMs = this.cfg.spawnDelayMs ? randRange(this.cfg.spawnDelayMs) : 0
    if (slot.pendingMs <= 0) this._spawnIntoSlot(slot, { flash })
  }

  update(dtMs) {
    if (this.mode === 'continuous') {
      this.mover.update(dtMs / 1000)
      this.target.update(dtMs)
      const cur = this.getCursorPos()
      const isOnTarget = this.target.containsPoint(cur.x, cur.y)
      const entered = isOnTarget && !this.wasOnTarget
      this.wasOnTarget = isOnTarget
      this.scorer.update(dtMs, isOnTarget)
      return { enteredTarget: entered }
    }

    for (const slot of this.slots) {
      if (!slot.target) {
        slot.pendingMs -= dtMs
        if (slot.pendingMs <= 0) this._spawnIntoSlot(slot)
        continue
      }
      slot.target.update(dtMs)
      if (slot.decoy) slot.decoy.update(dtMs)

      const { shrink, jump } = this.cfg
      if (shrink) {
        const t = (slot.target.timeAliveMs - shrink.fromMs) / shrink.overMs
        slot.target.scale = 1 - Math.min(1, Math.max(0, t)) * (1 - shrink.minScale)
      }
      if (jump && !slot.jumped && slot.target.timeAliveMs >= jump.afterMs) {
        slot.jumped = true
        const theta = Math.random() * Math.PI * 2
        const d = jump.distanceFrac * this.minDim
        const p = clampToArenaBounds2D(slot.target.x + Math.cos(theta) * d, slot.target.y + Math.sin(theta) * d, this.width, this.height, this.marginX, this.marginY)
        slot.target.moveTo(p.x, p.y)
      }
      // Expiring unhit is not a registered miss (same rule the old drills
      // had) — the lost point IS the penalty; accuracy only judges clicks.
      if (this.cfg.timeoutMs && slot.target.timeAliveMs >= this.cfg.timeoutMs) {
        this._retireSlot(slot)
      }
    }
    return { enteredTarget: false }
  }

  click(pos) {
    if (this.mode === 'continuous') return { hit: false }

    // Real targets win over decoys when both overlap the click point.
    const hitSlot = this.slots.find((s) => s.target && !s.noGo && s.target.containsPoint(pos.x, pos.y))
    if (hitSlot) {
      const target = hitSlot.target
      const points = this.cfg.rings
        ? (target.normalizedDistance(pos.x, pos.y) <= this.cfg.rings.innerFrac ? this.cfg.rings.innerPoints : this.cfg.rings.outerPoints)
        : 1
      this.scorer.registerShot(true, target.timeAliveMs, points)
      this.chainAnchor = { x: target.x, y: target.y }
      this._retireSlot(hitSlot, { flash: true })
      return { hit: true }
    }

    // A no-go target or a decoy that got shot counts as a plain miss and
    // (for no-go) leaves the arena immediately — the mistake was made.
    const noGoSlot  = this.slots.find((s) => s.target && s.noGo && s.target.containsPoint(pos.x, pos.y))
    const decoySlot = this.slots.find((s) => s.decoy && s.decoy.containsPoint(pos.x, pos.y))
    this.scorer.registerShot(false, 0)
    if (noGoSlot) this._retireSlot(noGoSlot)
    else if (decoySlot) decoySlot.decoy = null
    return { hit: false }
  }

  // Called by ExercisePlayer whenever the PLAYABLE FIELD itself resizes
  // (window resize, sidebar collapse/expand, maximize). Rescales everything
  // already on screen proportionally to the new dimensions — no target
  // "teleports" to an unrelated spot, it just tracks the same relative
  // position it already had — then re-clamps into the new margin-safe field
  // as a final safety net (covers the canvas being resized to a very
  // different aspect ratio, where naive proportional scaling alone
  // wouldn't guarantee containment).
  resize(newWidth, newHeight) {
    const oldWidth = this.width, oldHeight = this.height
    if (newWidth <= 0 || newHeight <= 0) return
    const scaleX = oldWidth  > 0 ? newWidth  / oldWidth  : 1
    const scaleY = oldHeight > 0 ? newHeight / oldHeight : 1

    this.width  = newWidth
    this.height = newHeight
    this._recomputeSpatials(newWidth, newHeight)

    const rescale = (t) => {
      if (!t) return
      const p = clampToArenaBounds2D(t.x * scaleX, t.y * scaleY, newWidth, newHeight, this.marginX, this.marginY)
      t.x = p.x
      t.y = p.y
      t.radius = this.radius
    }

    if (this.mode === 'continuous') {
      rescale(this.target)
      this.mover.resize(newWidth, newHeight, this.marginX, this.marginY)
      return
    }

    for (const slot of this.slots) {
      rescale(slot.target)
      rescale(slot.decoy)
    }
    if (this.chainAnchor) {
      const p = clampToArenaBounds2D(this.chainAnchor.x * scaleX, this.chainAnchor.y * scaleY, newWidth, newHeight, this.marginX, this.marginY)
      this.chainAnchor = p
    }
    if (this.cfg.spawn === 'grid') this.gridCells = this._buildGridCells(this.cfg.grid)
    if (this.cfg.spawn === 'duo')  this.duoPosts  = this._buildDuoPosts()
  }

  draw(ctx) {
    if (this.mode === 'continuous') {
      this.target.draw(ctx)
      return
    }
    for (const slot of this.slots) {
      if (slot.decoy) slot.decoy.draw(ctx)
      if (slot.target) slot.target.draw(ctx)
    }
  }

  get hud() {
    return {
      score:       this.scorer.score,
      accuracyPct: this.scorer.accuracyPct,
      streak:      this.mode === 'continuous' ? this.scorer.currentStreakMs : this.scorer.currentStreak,
    }
  }

  get result() {
    return {
      score:         this.scorer.score,
      accuracyPct:   this.scorer.accuracyPct,
      bestStreakMs:  this.mode === 'continuous' ? this.scorer.bestStreakMs : 0,
      avgReactionMs: this.mode === 'click' ? this.scorer.avgReactionMs : 0,
      mode:          this.mode,
    }
  }
}

export function createDrillSession(drill, difficultyKey, width, height, getCursorPos) {
  return new DrillSession(drill, difficultyKey, width, height, getCursorPos)
}
