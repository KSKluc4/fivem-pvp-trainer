import { ClickTarget, ClickScorer } from '../engine/clickTarget.js'
import { pointNearForward } from '../engine/spawn.js'

// "Quick Flick" — the target spawns at a random angle/distance from
// wherever the player is CURRENTLY looking (a flick is a fast reorientation
// onto an off-center target, not a target that happens to be centered
// already) and vanishes if not hit within the timeout. Own identity, not a
// clone of any third-party trainer's named drill.
export const EXERCISE_ID = 'quick_flick'
export const SESSION_DURATION_S = 60

// Fixed across difficulties per spec — only target size and flick distance
// scale with difficulty, the reaction window itself doesn't change.
const TIMEOUT_MS = 1200

export const DIFFICULTIES = {
  facil:   { radius: 0.50, distanceRange: [1.0, 2.5], timeoutMs: TIMEOUT_MS },
  medio:   { radius: 0.38, distanceRange: [1.5, 3.5], timeoutMs: TIMEOUT_MS },
  dificil: { radius: 0.26, distanceRange: [2.0, 4.5], timeoutMs: TIMEOUT_MS },
}

export function createTarget(scene, difficultyKey = 'medio', camera) {
  const cfg = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
  return new ClickTarget(scene, {
    spawnPosition: () => pointNearForward(camera, cfg.distanceRange),
    radius: cfg.radius,
  })
}

export { ClickScorer as Scorer }
