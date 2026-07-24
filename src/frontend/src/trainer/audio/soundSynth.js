// Procedural sound effects — plain PCM synthesis (oscillators + noise +
// exponential envelopes), no Web Audio dependency here so this stays a pure,
// deterministic module directly unit-testable in node:test. trainerAudio.js
// (browser-only) copies the returned Float32Arrays into real AudioBuffers.
//
// Everything here is generated, not sourced — see assets/CREDITS.md.

// Deterministic PRNG (mulberry32) so the "noise" component of the shoot
// sound is reproducible across runs/tests instead of drifting with
// Math.random.
function mulberry32(seed) {
  let a = seed
  return function rand() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Linear attack, exponential decay — cheap and reads as a percussive "hit"
// regardless of what tone/noise it's shaping.
function envelope(t, attackS, decayS) {
  if (t < attackS) return t / attackS
  return Math.exp(-(t - attackS) / decayS)
}

function normalizeInPlace(samples) {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > peak) peak = abs
  }
  if (peak > 0) {
    const gain = 1 / peak
    for (let i = 0; i < samples.length; i++) samples[i] *= gain
  }
  return samples
}

// Short percussive noise burst + a low pitch-dropping tone — a synthesized
// "pew" rather than a recorded gunshot. ~120ms.
export function synthesizeShoot(sampleRate = 44100) {
  const durationS = 0.12
  const n = Math.max(1, Math.round(durationS * sampleRate))
  const samples = new Float32Array(n)
  const rand = mulberry32(1337)
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = envelope(t, 0.002, 0.045)
    const noise = rand() * 2 - 1
    const dropHz = 140 - t * 400 // quick downward pitch sweep
    const tone = Math.sin(2 * Math.PI * Math.max(40, dropHz) * t)
    samples[i] = (noise * 0.65 + tone * 0.35) * env
  }
  return normalizeInPlace(samples)
}

// Two-tone bright "ding" — the satisfying hit-confirm feedback. ~140ms.
export function synthesizeHit(sampleRate = 44100) {
  const durationS = 0.14
  const n = Math.max(1, Math.round(durationS * sampleRate))
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = envelope(t, 0.001, 0.05)
    const tone = Math.sin(2 * Math.PI * 1200 * t) * 0.5 + Math.sin(2 * Math.PI * 1800 * t) * 0.5
    samples[i] = tone * env
  }
  return normalizeInPlace(samples)
}

// Very short, subtle tick for Tracking Suave's optional "on target" cue
// (off by default — see trainerAudioSettings.js). ~40ms.
export function synthesizeOnTargetTick(sampleRate = 44100) {
  const durationS = 0.04
  const n = Math.max(1, Math.round(durationS * sampleRate))
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = envelope(t, 0.001, 0.015)
    samples[i] = Math.sin(2 * Math.PI * 2400 * t) * env
  }
  return normalizeInPlace(samples)
}
