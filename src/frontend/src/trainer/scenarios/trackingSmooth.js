import * as THREE from 'three'
import { ARENA_BOUNDS } from '../engine/scene'

// "Smooth Tracking" — a single target drifting through fluid, pseudo-random
// direction changes (steering toward a new random heading rather than
// snapping to it). Own identity, not a clone of any third-party trainer's
// named drill.
export const EXERCISE_ID = 'tracking_suave'
export const SESSION_DURATION_S = 60

// Speed/turn tuning per difficulty. Display labels live in the locale files
// under trainer.dificuldades.<key> — this module only carries gameplay data.
export const DIFFICULTIES = {
  facil:   { speed: 1.6, turnInterval: [1.3, 2.2], turnRate: 1.2 },
  medio:   { speed: 2.8, turnInterval: [0.9, 1.6], turnRate: 1.6 },
  dificil: { speed: 4.2, turnInterval: [0.6, 1.1], turnRate: 2.2 },
}

const TARGET_RADIUS = 0.4

function randRange([min, max]) {
  return min + Math.random() * (max - min)
}

function randomPointInBounds() {
  return new THREE.Vector3(
    randRange(ARENA_BOUNDS.x),
    randRange(ARENA_BOUNDS.y),
    randRange(ARENA_BOUNDS.z),
  )
}

function randomDirection() {
  const v = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5)
  return v.lengthSq() > 0 ? v.normalize() : new THREE.Vector3(1, 0, 0)
}

export class SmoothTarget {
  constructor(scene, difficultyKey = 'medio') {
    this.difficulty  = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
    this.position    = randomPointInBounds()
    this.direction    = randomDirection()
    this.turnTarget   = this.direction.clone()
    this.nextTurnIn   = randRange(this.difficulty.turnInterval)

    const geometry = new THREE.SphereGeometry(TARGET_RADIUS, 24, 16)
    const material = new THREE.MeshStandardMaterial({
      color: '#ff4757', roughness: 0.4, metalness: 0.1,
      emissive: '#4d0d14', emissiveIntensity: 0.6,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(dt) {
    this.nextTurnIn -= dt
    if (this.nextTurnIn <= 0) {
      this.turnTarget = randomDirection()
      this.nextTurnIn = randRange(this.difficulty.turnInterval)
    }
    // Blend toward the new heading instead of snapping — keeps the path fluid.
    this.direction.lerp(this.turnTarget, Math.min(1, dt * this.difficulty.turnRate))
    if (this.direction.lengthSq() > 0) this.direction.normalize()

    this.position.addScaledVector(this.direction, this.difficulty.speed * dt)
    this._bounce()
    this.mesh.position.copy(this.position)
  }

  _bounce() {
    for (const axis of ['x', 'y', 'z']) {
      const [min, max] = ARENA_BOUNDS[axis]
      if (this.position[axis] < min) { this.position[axis] = min; this.direction[axis] *= -1 }
      if (this.position[axis] > max) { this.position[axis] = max; this.direction[axis] *= -1 }
    }
  }

  dispose(scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}

// Time-on-target scoring. Score is milliseconds spent with the crosshair on
// the target — a plain, legible number that also doubles as the persisted
// `score` column (no separate normalization step to keep in sync).
export class TrackingScorer {
  constructor() {
    this.onTargetMs    = 0
    this.totalMs       = 0
    this.currentStreakMs = 0
    this.bestStreakMs   = 0
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
