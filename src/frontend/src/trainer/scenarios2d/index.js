import * as tracking2d from './tracking2d.js'
import * as grid2d from './grid2d.js'
import * as flick2d from './flick2d.js'
import * as micro2d from './micro2d.js'

// Normalizes every 2D scenario module behind one shape so TrainerView/
// ExercisePlayer never import a specific scenario directly — the 2D
// analogue of the old scenarios/index.js. `mode` decides which loop logic
// runs in the player: 'continuous' (Tracking Suave — hover scoring, driven
// by the render loop) or 'click' (the 3 others — click-to-hit + timeout).
export const SCENARIOS = {
  tracking_2d: {
    id:               tracking2d.EXERCISE_ID,
    mode:             'continuous',
    sessionDurationS: tracking2d.SESSION_DURATION_S,
    difficulties:     tracking2d.DIFFICULTIES,
    createTarget:     (width, height, difficultyKey) => tracking2d.createTarget(width, height, difficultyKey),
    createScorer:     () => new tracking2d.Scorer(),
  },
  grid_2d: {
    id:               grid2d.EXERCISE_ID,
    mode:             'click',
    sessionDurationS: grid2d.SESSION_DURATION_S,
    difficulties:     grid2d.DIFFICULTIES,
    createTarget:     (width, height, difficultyKey) => grid2d.createTarget(width, height, difficultyKey),
    createScorer:     () => new grid2d.Scorer(),
  },
  flick_2d: {
    id:               flick2d.EXERCISE_ID,
    mode:             'click',
    sessionDurationS: flick2d.SESSION_DURATION_S,
    difficulties:     flick2d.DIFFICULTIES,
    createTarget:     (width, height, difficultyKey, getCursorPos) => flick2d.createTarget(width, height, difficultyKey, getCursorPos),
    createScorer:     () => new flick2d.Scorer(),
  },
  micro_2d: {
    id:               micro2d.EXERCISE_ID,
    mode:             'click',
    sessionDurationS: micro2d.SESSION_DURATION_S,
    difficulties:     micro2d.DIFFICULTIES,
    createTarget:     (width, height, difficultyKey, getCursorPos) => micro2d.createTarget(width, height, difficultyKey, getCursorPos),
    createScorer:     () => new micro2d.Scorer(),
  },
}

export const EXERCISE_IDS = Object.keys(SCENARIOS)
