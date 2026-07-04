// Proves the in-app 3D trainer reproduces *exactly* the same sensitivity
// feel as the existing GTA V → aim-trainer converter: same input, same
// numbers. Both trainerSensitivity.js and SensConverter.jsx import their
// math from the same services/sensitivityMath.js module, so this is largely
// a regression guard against that ever drifting apart again.
import test from 'node:test'
import assert from 'node:assert/strict'

import { calcLocal, degPerCountFromGtaSens, GTA_YAW } from '../../services/sensitivityMath.js'
import { effectiveDegPerCount } from './trainerSensitivity.js'

test('calcLocal reproduces the known reference conversion (50 sens, 800 dpi)', () => {
  const result = calcLocal(50, 800)
  assert.equal(result.cm_per_360, 25.4)
  assert.equal(result.inverted, false)
})

test('degPerCountFromGtaSens matches GTA_YAW * |sens|', () => {
  assert.equal(degPerCountFromGtaSens(50), 50 * GTA_YAW)
  assert.equal(degPerCountFromGtaSens(-35), 35 * GTA_YAW) // inverted sens still yields a positive rotation rate
})

test('same gtaSens input yields the same degrees-per-count regardless of DPI', () => {
  // This is the mathematical claim the trainer relies on: raw mouse counts
  // are already DPI-scaled by the OS, so only the sensitivity value (not
  // DPI) should determine camera rotation per count.
  for (const gtaSens of [10, 35, 50, 80, 100]) {
    const degPerCounts = [400, 800, 1600, 3200].map((dpi) => {
      const { cm_per_360 } = calcLocal(gtaSens, dpi)
      const cmPerInch = cm_per_360 / 2.54
      const degPerInch = 360 / cmPerInch
      return degPerInch / dpi
    })
    for (const d of degPerCounts) {
      // calcLocal rounds cm_per_360 to 4 decimals (it's meant for display),
      // so the reverse-derived value carries a little rounding noise.
      assert.ok(Math.abs(d - degPerCountFromGtaSens(gtaSens)) < 1e-4)
    }
  }
})

test('effectiveDegPerCount scales linearly with the fine-tune multiplier', () => {
  const base = degPerCountFromGtaSens(50)
  assert.equal(effectiveDegPerCount({ gtaSens: 50, fineTuneMultiplier: 1.0 }), base)
  assert.equal(effectiveDegPerCount({ gtaSens: 50, fineTuneMultiplier: 0.5 }), base * 0.5)
  assert.equal(effectiveDegPerCount({ gtaSens: 50, fineTuneMultiplier: 1.5 }), base * 1.5)
})

test('effectiveDegPerCount defaults fineTuneMultiplier to 1 when omitted', () => {
  assert.equal(effectiveDegPerCount({ gtaSens: 50 }), degPerCountFromGtaSens(50))
})
