import { pointNearCursor2D } from '../engine2d/spawn2d.js'
import { Target2D } from '../engine2d/target2d.js'
import { ClickScorer2D } from '../engine2d/clickScorer2d.js'
import { DRILL_ACCENTS, TARGET_COLOR } from '../engine2d/theme2d.js'

// "Flick Rápido" (2D) — the target spawns at a random angle/distance from
// wherever the cursor CURRENTLY is (a flick is a fast reorientation onto an
// off-center target) and vanishes if not hit within the timeout. New key
// (flick_2d) — replaces the 3D quick_flick, own scoring scale.
export const EXERCISE_ID = 'flick_2d'
export const SESSION_DURATION_S = 60

// Fixed across difficulties per spec — only target size and flick distance
// scale with difficulty, the reaction window itself doesn't change.
const TIMEOUT_MS = 1200

// distanceRangeFrac is a fraction of min(canvasWidth, canvasHeight).
export const DIFFICULTIES = {
  facil:   { radiusFrac: 0.058, distanceRangeFrac: [0.12, 0.30], timeoutMs: TIMEOUT_MS },
  medio:   { radiusFrac: 0.045, distanceRangeFrac: [0.18, 0.42], timeoutMs: TIMEOUT_MS },
  dificil: { radiusFrac: 0.032, distanceRangeFrac: [0.24, 0.54], timeoutMs: TIMEOUT_MS },
}

// `getCursorPos`: () => {x, y} — the live cursor position, playing the same
// role `camera` played in the old pointNearForward-based scenarios.
export function createTarget(width, height, difficultyKey = 'medio', getCursorPos) {
  const cfg    = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
  const radius = cfg.radiusFrac * Math.min(width, height)
  return new Target2D({
    spawnPosition: () => pointNearCursor2D(getCursorPos(), cfg.distanceRangeFrac, width, height),
    radius,
    color: TARGET_COLOR,
    glowColor: DRILL_ACCENTS.flick_2d,
  })
}

export { ClickScorer2D as Scorer }
