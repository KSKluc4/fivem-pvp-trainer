import * as THREE from 'three'

// Generic single-target "click to hit" primitive shared by every click-based
// scenario (Shot Grid, Quick Flick, Micro Adjust) — each one only supplies a
// spawnPosition function and difficulty numbers (radius/timeout), none
// reimplement spawn/respawn/dispose.
export class ClickTarget {
  constructor(scene, { spawnPosition, radius, color = '#ff4757', emissive = '#4d0d14' }) {
    this.spawnPosition = spawnPosition // () => THREE.Vector3
    this.radius        = radius
    this.timeAliveMs    = 0

    const geometry = new THREE.SphereGeometry(radius, 20, 14)
    const material = new THREE.MeshStandardMaterial({
      color, roughness: 0.4, metalness: 0.1, emissive, emissiveIntensity: 0.6,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.copy(this.spawnPosition())
    scene.add(this.mesh)
  }

  update(dtMs) {
    this.timeAliveMs += dtMs
  }

  respawn() {
    this.mesh.position.copy(this.spawnPosition())
    this.timeAliveMs = 0
  }

  dispose(scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}

// Hit/miss/reaction-time scorer shared by every click-based scenario.
// `bestStreakMs` is always 0 — kept only so a click-mode result object has
// the same shape as TrackingScorer's, letting ResultsScreen/finishSession
// treat both uniformly instead of branching on which fields exist.
export class ClickScorer {
  constructor() {
    this.hits            = 0
    this.shotsFired       = 0
    this.reactionTimesMs  = []
    this.bestStreakMs     = 0
  }

  // reactionMs: how long the target had been alive when this shot was fired.
  registerShot(hit, reactionMs) {
    this.shotsFired += 1
    if (hit) {
      this.hits += 1
      this.reactionTimesMs.push(reactionMs)
    }
  }

  get score() {
    return this.hits
  }

  get accuracyPct() {
    return this.shotsFired > 0 ? (this.hits / this.shotsFired) * 100 : 0
  }

  get avgReactionMs() {
    if (this.reactionTimesMs.length === 0) return 0
    return this.reactionTimesMs.reduce((a, b) => a + b, 0) / this.reactionTimesMs.length
  }
}
