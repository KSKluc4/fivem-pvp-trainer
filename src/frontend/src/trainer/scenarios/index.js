import * as trackingSuave from './trackingSmooth.js'
import * as shotGrid from './shotGrid.js'
import * as quickFlick from './quickFlick.js'
import * as microAdjust from './microAdjust.js'

// Normalizes every scenario module behind one shape so TrainerView/ExercisePlayer
// never import a specific scenario directly. `mode` decides which loop logic
// runs in the player: 'continuous' (Tracking Suave — hover scoring, driven by
// the render loop) or 'click' (the 3 new drills — click-to-hit + timeout,
// driven by canvas click events and per-frame timeout checks).
export const SCENARIOS = {
  tracking_suave: {
    id:               trackingSuave.EXERCISE_ID,
    mode:             'continuous',
    sessionDurationS: trackingSuave.SESSION_DURATION_S,
    difficulties:     trackingSuave.DIFFICULTIES,
    createTarget:     (scene, difficultyKey) => new trackingSuave.SmoothTarget(scene, difficultyKey),
    createScorer:     () => new trackingSuave.TrackingScorer(),
  },
  shot_grid: {
    id:               shotGrid.EXERCISE_ID,
    mode:             'click',
    sessionDurationS: shotGrid.SESSION_DURATION_S,
    difficulties:     shotGrid.DIFFICULTIES,
    createTarget:     (scene, difficultyKey) => shotGrid.createTarget(scene, difficultyKey),
    createScorer:     () => new shotGrid.Scorer(),
  },
  quick_flick: {
    id:               quickFlick.EXERCISE_ID,
    mode:             'click',
    sessionDurationS: quickFlick.SESSION_DURATION_S,
    difficulties:     quickFlick.DIFFICULTIES,
    createTarget:     (scene, difficultyKey, camera) => quickFlick.createTarget(scene, difficultyKey, camera),
    createScorer:     () => new quickFlick.Scorer(),
  },
  micro_adjust: {
    id:               microAdjust.EXERCISE_ID,
    mode:             'click',
    sessionDurationS: microAdjust.SESSION_DURATION_S,
    difficulties:     microAdjust.DIFFICULTIES,
    createTarget:     (scene, difficultyKey, camera) => microAdjust.createTarget(scene, difficultyKey, camera),
    createScorer:     () => new microAdjust.Scorer(),
  },
}

export const EXERCISE_IDS = Object.keys(SCENARIOS)
