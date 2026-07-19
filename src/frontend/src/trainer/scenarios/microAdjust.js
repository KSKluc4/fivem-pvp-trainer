import { ClickTarget, ClickScorer } from '../engine/clickTarget.js'
import { pointNearForward } from '../engine/spawn.js'

// "Micro Adjust" — small targets spawn very close to wherever the player is
// currently looking (small corrections, not flicks) with a short window
// before they expire — trains fine crosshair placement rather than fast
// reorientation. Own identity, not a clone of any third-party trainer's
// named drill.
export const EXERCISE_ID = 'micro_adjust'
export const SESSION_DURATION_S = 60

// Both target size AND the reaction window shrink with difficulty (unlike
// Quick Flick, where only size/distance scale and the timeout is fixed) —
// this is what the spec calls out as this drill's "janela curta" axis.
export const DIFFICULTIES = {
  facil:   { radius: 0.30, distanceRange: [0.15, 0.5], timeoutMs: 900 },
  medio:   { radius: 0.22, distanceRange: [0.15, 0.6], timeoutMs: 700 },
  dificil: { radius: 0.16, distanceRange: [0.15, 0.7], timeoutMs: 550 },
}

// Slightly closer forward distance than Quick Flick's default (7.5) — a
// tighter working plane makes the small angular offsets read as corrections
// right around the crosshair instead of a shrunken flick.
const FORWARD_DISTANCE = 5.5

export function createTarget(scene, difficultyKey = 'medio', camera) {
  const cfg = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
  return new ClickTarget(scene, {
    spawnPosition: () => pointNearForward(camera, cfg.distanceRange, FORWARD_DISTANCE),
    radius: cfg.radius,
  })
}

export { ClickScorer as Scorer }
