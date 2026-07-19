import * as THREE from 'three'
import { ClickTarget, ClickScorer } from '../engine/clickTarget.js'
import { randRange, clampToArenaBounds } from '../engine/spawn.js'
import { ARENA_BOUNDS } from '../engine/scene.js'

// "Shot Grid" — static targets appear one at a time across a flat plane in
// the arena; hit it and another spawns immediately. No timeout: unlike the
// flick/micro-adjust drills, hesitation isn't punished here, only misses
// are — a click that doesn't land resets nothing, it just costs accuracy.
// Own identity, not a clone of any third-party trainer's named drill.
export const EXERCISE_ID = 'shot_grid'
export const SESSION_DURATION_S = 60

// Difficulty only shrinks the target — position spread stays the same.
export const DIFFICULTIES = {
  facil:   { radius: 0.55, timeoutMs: null },
  medio:   { radius: 0.40, timeoutMs: null },
  dificil: { radius: 0.28, timeoutMs: null },
}

// Fixed depth so targets read as a flat grid/wall rather than floating
// spheres scattered through 3D space.
const GRID_Z = (ARENA_BOUNDS.z[0] + ARENA_BOUNDS.z[1]) / 2

function spawnPosition() {
  return clampToArenaBounds(new THREE.Vector3(randRange(ARENA_BOUNDS.x), randRange(ARENA_BOUNDS.y), GRID_Z))
}

export function createTarget(scene, difficultyKey = 'medio') {
  const { radius } = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
  return new ClickTarget(scene, { spawnPosition, radius })
}

export { ClickScorer as Scorer }
