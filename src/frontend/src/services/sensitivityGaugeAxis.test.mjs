// Regression guard for the v2.2.0 gauge-axis redesign: the arc's domain is
// now the literal -100..+100 sens slider (linear, DPI-independent for the
// needle), while zone SEGMENTS are computed per-DPI by converting each
// zone's cm/360 thresholds through the inverse of the sens->cm formula.
// These tests lock in: the needle reaching the true tips at +-100, the
// inverse conversion being mathematically correct (round-trips through
// calcLocal), segment boundaries matching that inverse at two different
// DPIs, and — carried over from the v2.1.1 fix — that the active zone
// (by cm classification) always matches the segment the needle sits in.
import test from 'node:test'
import assert from 'node:assert/strict'

import { calcLocal, sensForCm } from './sensitivityMath.js'
import { ZONES, zoneForCm, zoneCmRange } from './sensitivityZones.js'
import { AXIS_MIN, AXIS_MAX, angleForSens, zoneAngleRangeForDpi } from './sensitivityGaugeAxis.js'

test('needle sits exactly at the arc tips for sens=+-100 and dead-center for sens=0', () => {
  assert.equal(angleForSens(100), 90)
  assert.equal(angleForSens(-100), -90)
  assert.equal(angleForSens(0), 0)
})

test('angleForSens is linear and strictly monotonic across the whole -100..100 domain', () => {
  let prev = -Infinity
  for (let sens = -100; sens <= 100; sens += 1) {
    const angle = angleForSens(sens)
    assert.ok(angle > prev, `angle should strictly increase with sens (sens=${sens})`)
    prev = angle
  }
})

test('sensForCm is the true inverse of calcLocal, across DPIs and cm/360 values', () => {
  for (const dpi of [400, 800, 1600, 3200]) {
    for (const cm of [10, 15, 18, 24, 25, 40, 48, 60, 70, 120, 250]) {
      const sens = sensForCm(cm, dpi)
      const { cm_per_360 } = calcLocal(sens, dpi)
      assert.ok(Math.abs(cm_per_360 - cm) < 0.01, `dpi=${dpi} cm=${cm} round-trip got ${cm_per_360}`)
    }
  }
})

test('zone segment boundaries match the inverse cm->sens conversion at 400 and 1600 DPI', () => {
  for (const dpi of [400, 1600]) {
    for (const zone of ZONES) {
      const [lowerCm, upperCm] = zoneCmRange(zone)
      const expectedLower = Math.max(AXIS_MIN, sensForCm(upperCm, dpi))
      const expectedUpper = Math.min(AXIS_MAX, sensForCm(lowerCm, dpi))
      const range = zoneAngleRangeForDpi(zone, dpi)

      if (expectedLower >= expectedUpper) {
        assert.equal(range, null, `zone=${zone.id} dpi=${dpi} should be unreachable (not drawn)`)
      } else {
        assert.ok(range, `zone=${zone.id} dpi=${dpi} should have a visible segment`)
        const [startAngle, endAngle] = range
        assert.ok(Math.abs(startAngle - angleForSens(expectedLower)) < 1e-6)
        assert.ok(Math.abs(endAngle - angleForSens(expectedUpper)) < 1e-6)
      }
    }
  }
})

test('active zone (by cm classification) always matches the segment under the needle, across a full sens sweep at 400 and 1600 DPI', () => {
  for (const dpi of [400, 1600]) {
    for (let sens = -100; sens <= 100; sens += 1) {
      const cm = calcLocal(sens, dpi).cm_per_360
      const activeZone = zoneForCm(cm)
      const needleAngle = angleForSens(sens)
      const range = zoneAngleRangeForDpi(activeZone, dpi)
      assert.ok(range, `active zone ${activeZone.id} has no visible segment at dpi=${dpi} sens=${sens}`)
      const [start, end] = range
      assert.ok(
        needleAngle >= start - 1e-6 && needleAngle <= end + 1e-6,
        `sens=${sens} dpi=${dpi} needle (${needleAngle}) not within active zone ${activeZone.id} segment [${start}, ${end}]`,
      )
    }
  }
})
