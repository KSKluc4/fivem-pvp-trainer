// Pure decision logic for the "smart resume" welcome-back card (Rotina do
// dia). No React here on purpose — resolveWelcomeState is a plain function
// of its inputs, so every scenario is a one-line unit test and the
// component (WelcomeCard.jsx) only has to render whatever comes out.
//
// "Last active" is derived entirely from aim-trainer drill history
// (categoryLastTrainedTimestamps, aimLevel.js) — not from the daily
// routine/streak history. This card's whole point is aim-trainer category
// focus (repeat/vary a category, or suggest a preset), so the aim trainer's
// own activity is the coherent signal for it, and it's already loaded
// wherever this card renders (useAllTrainerScores) — no extra request.
// A player who trains only via the in-game mata-mata block and never opens
// the aim trainer will read as "new_user"/"idle" here even though they do
// train — an accepted simplification, not a bug: the card's suggestions
// (presets, category focus) are aim-trainer actions, so it's fine for its
// framing to be aim-trainer-scoped too.
//
// RECENT_WINDOW_DAYS is the boundary between "treinou ontem/hoje" (recent)
// and "sem treino há 3+ dias" (idle) — the user's own two buckets, with no
// gap between them: 0/1/2 days ago is "recent", 3+ is "idle".

import { CATEGORIES } from './catalog.js'
import { categoryLastTrainedTimestamps, perCategoryLevels, suggestVariationCategory } from './aimLevel.js'
import { CATEGORY_TO_PRESET } from './presets.js'

export const RECENT_WINDOW_DAYS = 3
export const IDLE_SUGGESTION_PRESET = 'aquecimento_rapido'
export const COMPLETED_SUGGESTION_PRESET = 'aquecimento_rapido'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function mostRecentCategory(timestamps) {
  return CATEGORIES.slice().sort((a, b) => timestamps[b] - timestamps[a])[0]
}

// {scoresByExercise, sessionCompleted, streak, now}. `now` is injectable
// for tests; defaults to the real clock.
export function resolveWelcomeState({ scoresByExercise, sessionCompleted = false, streak = 0, now = new Date() }) {
  // Today's routine (or a preset) is already done — this takes priority
  // over everything else since it's specifically about TODAY, regardless
  // of any prior activity pattern.
  if (sessionCompleted) {
    return { variant: 'completed', streak, suggestedPresetId: COMPLETED_SUGGESTION_PRESET }
  }

  const timestamps = categoryLastTrainedTimestamps(scoresByExercise)
  const lastActiveMs = Math.max(...CATEGORIES.map((c) => timestamps[c]))

  if (!Number.isFinite(lastActiveMs)) {
    return { variant: 'new_user' }
  }

  const daysSince = Math.floor((now.getTime() - lastActiveMs) / MS_PER_DAY)

  if (daysSince >= RECENT_WINDOW_DAYS) {
    return { variant: 'idle', daysSince, suggestedPresetId: IDLE_SUGGESTION_PRESET }
  }

  const levels = perCategoryLevels(scoresByExercise)
  const lastCategory      = mostRecentCategory(timestamps)
  const suggestedCategory = suggestVariationCategory(scoresByExercise, levels, lastCategory)

  return {
    variant: 'recent',
    daysSince,
    lastCategory,
    suggestedCategory,
    repeatPresetId:  CATEGORY_TO_PRESET[lastCategory],
    varyPresetId:    CATEGORY_TO_PRESET[suggestedCategory],
  }
}
