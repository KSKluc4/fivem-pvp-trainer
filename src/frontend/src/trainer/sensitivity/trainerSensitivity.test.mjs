// Proves the in-app 3D trainer reproduces *exactly* the same sensitivity
// feel as "Minha Sensibilidade": same input, same numbers. Both
// trainerSensitivity.js and Sensitivity.jsx import their math from the same
// services/sensitivityMath.js module, so this is largely a regression guard
// against that ever drifting apart again.
import test from 'node:test'
import assert from 'node:assert/strict'

import { calcLocal, degPerCountFromGtaSens, effectiveSensMagnitude, GTA_YAW } from '../../services/sensitivityMath.js'
import { effectiveDegPerCount } from './trainerSensitivity.js'

test('calcLocal reproduces the known reference conversion (50 sens, 800 dpi)', () => {
  const result = calcLocal(50, 800)
  assert.equal(result.cm_per_360, 25.4)
  assert.equal('inverted' in result, false) // no axis-invert concept — see conceptual fix below
})

// ── Conceptual fix: the -100..+100 slider is a continuous SPEED dial, not a
// magnitude+axis-invert pair. Negative values are genuinely slower turning
// (never an inverted Y axis) — -30 and +30 must NOT produce the same result.

test('negative and positive sensitivity of the same magnitude are NOT equal', () => {
  // This was the bug: Math.abs(gtaSens) collapsed -30 and +30 to one value.
  const negative = calcLocal(-30, 800)
  const positive = calcLocal(30, 800)
  assert.notEqual(negative.cm_per_360, positive.cm_per_360)
})

test('negative sensitivity is slower (larger cm/360) than the same positive magnitude', () => {
  const negative = calcLocal(-30, 800)
  const positive = calcLocal(30, 800)
  assert.ok(negative.cm_per_360 > positive.cm_per_360)
})

test('cm/360 is strictly monotonic across the entire -100..100 domain (property test)', () => {
  // For any a < b in the valid range, cm360(a) must be strictly greater than
  // cm360(b) — slower always needs more physical mouse movement than faster,
  // with no discontinuity or inversion anywhere, including through zero.
  const values = []
  for (let v = -100; v <= 100; v += 1) values.push(v)
  const cms = values.map((v) => calcLocal(v, 800).cm_per_360)
  for (let i = 0; i < cms.length - 1; i++) {
    assert.ok(
      cms[i] > cms[i + 1],
      `cm360(${values[i]})=${cms[i]} should be > cm360(${values[i + 1]})=${cms[i + 1]}`,
    )
  }
})

test('effectiveSensMagnitude never reaches zero or negative across the domain', () => {
  for (let v = -100; v <= 100; v += 1) {
    assert.ok(effectiveSensMagnitude(v) > 0)
  }
})

test('degPerCountFromGtaSens matches effectiveSensMagnitude * GTA_YAW', () => {
  assert.equal(degPerCountFromGtaSens(50), effectiveSensMagnitude(50) * GTA_YAW)
  assert.equal(degPerCountFromGtaSens(-35), effectiveSensMagnitude(-35) * GTA_YAW)
})

test('same gtaSens input yields the same degrees-per-count regardless of DPI', () => {
  // This is the mathematical claim the trainer relies on: raw mouse counts
  // are already DPI-scaled by the OS, so only the sensitivity value (not
  // DPI) should determine camera rotation per count.
  for (const gtaSens of [-80, -35, 10, 35, 50, 80, 100]) {
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
