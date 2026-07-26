import test from 'node:test'
import assert from 'node:assert/strict'
import { DRILLS } from '../catalog.js'
import { createDrillSession } from './drillSession.js'

// Regression test for the "targets spawn under the HUD / off the field"
// bug: the HUD used to be absolutely-positioned OVER the canvas, and target
// spawn bounds were a fixed universal fraction of the canvas unrelated to
// the target's own size — so a target could land partially behind HUD text
// or clipped by the field edge, making it unclickable and silently
// corrupting score/accuracy/aim-level data.
//
// The fix: ExercisePlayer now gives DrillSession the size of the PLAYABLE
// FIELD ONLY (the HUD lives in its own bar outside that area entirely), and
// every spawn position is clamped to margin = target's own (aspect-
// corrected) radius + slack. This test proves containment for every real
// catalog drill, every difficulty, several field sizes (including a very
// wide/short one and the app's realistic minimum), with the cursor at each
// of the 4 corners (the case that stresses nearCursor/chain spawning the
// hardest) — both at spawn time AND after the target has been alive and
// moving/jumping for a while.

const FIELD_SIZES = [
  { width: 1280, height: 720, label: '1280x720 (typical)' },
  { width: 1600, height: 400, label: '1600x400 (very wide, short)' },
  { width: 600,  height: 430, label: '600x430 (near the app\'s real minimum)' },
  { width: 320,  height: 320, label: '320x320 (small square)' },
]
const DIFFICULTIES = ['facil', 'medio', 'dificil']

function corners(width, height) {
  return [
    { x: 0, y: 0 }, { x: width, y: 0 },
    { x: 0, y: height }, { x: width, y: height },
  ]
}

// Checks the target's full (aspect-corrected) visual extent — not just its
// center point — never escapes the field. A tiny epsilon absorbs floating
// point rounding, not real containment slack.
function assertContained(t, width, height, label) {
  const rx = t.radius * t.aspectX
  const ry = t.radius * t.aspectY
  const EPS = 1e-6
  assert.ok(t.x - rx >= -EPS, `${label}: left edge escapes field (x=${t.x}, rx=${rx})`)
  assert.ok(t.x + rx <= width + EPS, `${label}: right edge escapes field (x=${t.x}, rx=${rx}, width=${width})`)
  assert.ok(t.y - ry >= -EPS, `${label}: top edge escapes field (y=${t.y}, ry=${ry})`)
  assert.ok(t.y + ry <= height + EPS, `${label}: bottom edge escapes field (y=${t.y}, ry=${ry}, height=${height})`)
}

function assertSlotsContained(session, width, height, label) {
  if (session.mode === 'continuous') {
    assertContained(session.target, width, height, label)
    return
  }
  for (const slot of session.slots) {
    if (slot.target) assertContained(slot.target, width, height, `${label} (target)`)
    if (slot.decoy)  assertContained(slot.decoy,  width, height, `${label} (decoy)`)
  }
}

test('every catalog drill, every difficulty, every field size, every corner cursor: no target ever escapes the field — at spawn or after moving/jumping', () => {
  for (const drill of DRILLS) {
    for (const difficulty of DIFFICULTIES) {
      for (const { width, height, label: sizeLabel } of FIELD_SIZES) {
        for (const cursor of corners(width, height)) {
          const label = `${drill.id}/${difficulty}/${sizeLabel}/cursor(${cursor.x},${cursor.y})`
          let cursorPos = cursor
          const session = createDrillSession(drill, difficulty, width, height, () => cursorPos)

          assertSlotsContained(session, width, height, `${label} @ spawn`)

          // Advance simulated time in coarse steps, covering timeoutMs
          // expiry, jump.afterMs relocation, and (for tracking drills)
          // several turnInterval/pauseEvery cycles and wall bounces —
          // re-checking containment after every single tick.
          for (let i = 0; i < 60; i++) {
            session.update(50) // 50ms/tick, 3s simulated total
            assertSlotsContained(session, width, height, `${label} @ t=${(i + 1) * 50}ms`)

            // Also exercise click-driven respawns (hit registration, chain
            // anchor, decoy/no-go retirement) — click wherever the first
            // slot's target currently is, a few times through the run.
            if (session.mode === 'click' && i % 10 === 0) {
              const target = session.slots[0]?.target
              if (target) {
                session.click({ x: target.x, y: target.y })
                assertSlotsContained(session, width, height, `${label} @ t=${(i + 1) * 50}ms (post-click)`)
              }
            }

            // Move the cursor around too, for nearCursor/chain drills whose
            // spawn position tracks it — including sweeping back through
            // the opposite corner mid-session.
            if (i === 30) cursorPos = { x: width - cursor.x, y: height - cursor.y }
          }
        }
      }
    }
  }
})
