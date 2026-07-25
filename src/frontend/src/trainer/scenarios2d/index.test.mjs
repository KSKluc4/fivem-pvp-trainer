import test from 'node:test'
import assert from 'node:assert/strict'
import { SCENARIOS, EXERCISE_IDS } from './index.js'

test('EXERCISE_IDS is exactly the 4 new 2D drill keys', () => {
  assert.deepEqual([...EXERCISE_IDS].sort(), ['flick_2d', 'grid_2d', 'micro_2d', 'tracking_2d'])
})

test('each scenario has the expected mode and a matching id', () => {
  assert.equal(SCENARIOS.tracking_2d.mode, 'continuous')
  assert.equal(SCENARIOS.grid_2d.mode, 'click')
  assert.equal(SCENARIOS.flick_2d.mode, 'click')
  assert.equal(SCENARIOS.micro_2d.mode, 'click')
  for (const key of EXERCISE_IDS) {
    assert.equal(SCENARIOS[key].id, key)
    assert.equal(SCENARIOS[key].sessionDurationS, 60)
    assert.deepEqual(Object.keys(SCENARIOS[key].difficulties), ['facil', 'medio', 'dificil'])
  }
})

test('createTarget and createScorer produce usable instances for every scenario', () => {
  const width = 800, height = 600
  for (const key of EXERCISE_IDS) {
    const scenario = SCENARIOS[key]
    const target = scenario.createTarget(width, height, 'medio', () => ({ x: width / 2, y: height / 2 }))
    assert.equal(typeof target.x, 'number')
    assert.equal(typeof target.y, 'number')
    assert.equal(typeof target.containsPoint, 'function')

    const scorer = scenario.createScorer()
    assert.equal(typeof scorer.score, 'number')
    assert.equal(typeof scorer.accuracyPct, 'number')
  }
})
