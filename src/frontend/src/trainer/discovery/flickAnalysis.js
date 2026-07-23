// Splits a single flick attempt's raw mouse-movement stream into the
// "initial flick" (the first impulse, up to its peak angular speed and the
// first significant deceleration/reversal after it) and everything that
// follows ("correction") — the core measurement the sensitivity-discovery
// test is built on.
//
// `samples` is a time-ordered list of `{ tMs, dProgressDeg }`, already
// projected onto the straight-line direction from the aim position at
// target-spawn to the target itself (positive = moving toward the target).
// Working in this single projected dimension — rather than raw 2D yaw/pitch
// — is what keeps the peak/deceleration search a simple 1D walk: the flick
// ratio the spec asks for ("ângulo do flick inicial / ângulo real até o
// alvo") is inherently about progress along that direct line.
//
// `trueAngleDeg` is the total angular distance from the aim position to the
// target at the moment it spawned.
const DECEL_FACTOR = 0.25 // flick "ends" once speed drops below 25% of its peak-so-far

export function analyzeFlick(samples, trueAngleDeg) {
  if (!samples || samples.length === 0 || !(trueAngleDeg > 0)) return null

  const n = samples.length
  const speeds = new Array(n)
  let prevT = 0
  for (let i = 0; i < n; i++) {
    const dtMs = Math.max(1, samples[i].tMs - prevT) // floor at 1ms — guards a same-tick double sample
    speeds[i] = samples[i].dProgressDeg / dtMs
    prevT = samples[i].tMs
  }

  let peak = speeds[0]
  let flickEndIdx = n - 1 // default: never decelerates — the whole stream is the flick
  let sawDrop = false
  for (let i = 1; i < n; i++) {
    if (speeds[i] > peak) {
      peak = speeds[i]
    } else if (peak > 0 && speeds[i] < peak * DECEL_FACTOR) {
      flickEndIdx = i - 1
      sawDrop = true
      break
    }
  }

  let flickAngleDeg = 0
  for (let i = 0; i <= flickEndIdx; i++) flickAngleDeg += samples[i].dProgressDeg

  const correctionTimeMs = sawDrop ? samples[n - 1].tMs - samples[flickEndIdx].tMs : 0

  return {
    ratio: flickAngleDeg / trueAngleDeg,
    flickAngleDeg,
    correctionTimeMs,
  }
}
