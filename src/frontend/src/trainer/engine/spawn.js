import * as THREE from 'three'
import { ARENA_BOUNDS } from './scene.js'

// Generic, exercise-agnostic spawn-position helpers shared by every
// scenario in scenarios/ — each scenario only supplies difficulty numbers
// (radius/distance/timeout), never its own position math.

export function randRange([min, max]) {
  return min + Math.random() * (max - min)
}

export function clampToArenaBounds(v) {
  for (const axis of ['x', 'y', 'z']) {
    const [min, max] = ARENA_BOUNDS[axis]
    v[axis] = Math.min(max, Math.max(min, v[axis]))
  }
  return v
}

// A uniformly random point anywhere in the arena — used by scenarios whose
// targets should appear regardless of where the player is currently
// looking (e.g. a grid of static targets across the whole play area).
export function randomPointInBounds() {
  return new THREE.Vector3(
    randRange(ARENA_BOUNDS.x),
    randRange(ARENA_BOUNDS.y),
    randRange(ARENA_BOUNDS.z),
  )
}

// A point offset from the camera's CURRENT forward direction by a random
// angle and a radius sampled from distanceRange — used by "flick"/"micro
// adjust" style scenarios, where a target spawning relative to wherever
// the player happens to be aiming (not a fixed world position) is what
// makes the drill a flick/correction in the first place. The offset is
// applied in the camera's own right/up plane so it reads as "near the
// crosshair" regardless of which way the player is looking, then clamped
// into ARENA_BOUNDS so it's always a valid, visible spawn.
export function pointNearForward(camera, distanceRange, forwardDistance = 7.5) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  const base = camera.position.clone().addScaledVector(forward, forwardDistance)

  const r     = randRange(distanceRange)
  const theta = Math.random() * Math.PI * 2

  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  const up    = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

  const point = base
    .addScaledVector(right, Math.cos(theta) * r)
    .addScaledVector(up, Math.sin(theta) * r)

  return clampToArenaBounds(point)
}
