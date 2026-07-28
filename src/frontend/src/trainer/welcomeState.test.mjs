import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveWelcomeState, RECENT_WINDOW_DAYS, IDLE_SUGGESTION_PRESET, COMPLETED_SUGGESTION_PRESET } from './welcomeState.js'

const NOW = new Date('2026-07-27T12:00:00Z')
const REP_DRILL = { tracking: 'tracking_2d', clicking: 'grid_2d', flicking: 'flick_2d', precision: 'micro_2d', reaction: 'reacao_gatilho_2d' }

function scoresAt(category, isoDate) {
  return { [REP_DRILL[category]]: [{ exercise: REP_DRILL[category], score: 1, created_at: isoDate }] }
}

function daysAgoIso(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

// ── completed — takes priority over everything else ─────────────────────────

test('sessionCompleted always wins, regardless of activity history', () => {
  const state = resolveWelcomeState({
    scoresByExercise: {}, // even a brand-new player
    sessionCompleted: true,
    streak: 4,
    now: NOW,
  })
  assert.equal(state.variant, 'completed')
  assert.equal(state.streak, 4)
  assert.equal(state.suggestedPresetId, COMPLETED_SUGGESTION_PRESET)
})

test('sessionCompleted wins even with very recent activity', () => {
  const scoresByExercise = scoresAt('tracking', daysAgoIso(0))
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: true, streak: 1, now: NOW })
  assert.equal(state.variant, 'completed')
})

// ── new_user — no aim-trainer activity ever ──────────────────────────────────

test('no scores anywhere and not completed today -> new_user', () => {
  const state = resolveWelcomeState({ scoresByExercise: {}, sessionCompleted: false, now: NOW })
  assert.equal(state.variant, 'new_user')
})

// ── idle — 3+ days since the last aim-trainer activity ───────────────────────

test('exactly RECENT_WINDOW_DAYS since last activity is idle, not recent (boundary)', () => {
  const scoresByExercise = scoresAt('flicking', daysAgoIso(RECENT_WINDOW_DAYS))
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: false, now: NOW })
  assert.equal(state.variant, 'idle')
  assert.equal(state.suggestedPresetId, IDLE_SUGGESTION_PRESET)
})

test('well past the idle threshold is still idle', () => {
  const scoresByExercise = scoresAt('flicking', daysAgoIso(30))
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: false, now: NOW })
  assert.equal(state.variant, 'idle')
  assert.equal(state.daysSince, 30)
})

// ── recent — 0, 1, or 2 days since the last aim-trainer activity ────────────

test('trained today (0 days) is recent', () => {
  const scoresByExercise = scoresAt('tracking', daysAgoIso(0))
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: false, now: NOW })
  assert.equal(state.variant, 'recent')
  assert.equal(state.daysSince, 0)
  assert.equal(state.lastCategory, 'tracking')
})

test('trained yesterday (1 day) is recent', () => {
  const scoresByExercise = scoresAt('clicking', daysAgoIso(1))
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: false, now: NOW })
  assert.equal(state.variant, 'recent')
  assert.equal(state.lastCategory, 'clicking')
})

test('one day before the idle boundary (RECENT_WINDOW_DAYS - 1) is still recent', () => {
  const scoresByExercise = scoresAt('precision', daysAgoIso(RECENT_WINDOW_DAYS - 1))
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: false, now: NOW })
  assert.equal(state.variant, 'recent')
})

test('recent variant picks the MOST recently trained category across all of them', () => {
  const scoresByExercise = {
    ...scoresAt('tracking', daysAgoIso(2)),
    ...scoresAt('clicking', daysAgoIso(0)), // most recent
    ...scoresAt('flicking', daysAgoIso(1)),
  }
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: false, now: NOW })
  assert.equal(state.lastCategory, 'clicking')
})

test('recent variant maps last/suggested categories to their presets, and never repeats the same preset for both', () => {
  const scoresByExercise = {
    ...scoresAt('tracking', daysAgoIso(0)), // trained today, most recent
    ...scoresAt('clicking', daysAgoIso(10)),
    ...scoresAt('flicking', daysAgoIso(10)),
    ...scoresAt('precision', daysAgoIso(10)),
    ...scoresAt('reaction', daysAgoIso(10)),
  }
  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted: false, now: NOW })
  assert.equal(state.lastCategory, 'tracking')
  assert.equal(state.repeatPresetId, 'foco_tracking')
  assert.notEqual(state.suggestedCategory, 'tracking') // never suggests "vary" into the same category just repeated
  assert.ok(state.varyPresetId)
  assert.notEqual(state.varyPresetId, undefined)
})
