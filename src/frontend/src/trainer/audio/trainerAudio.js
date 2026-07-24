// Browser-only glue: owns the single trainer AudioContext, synthesizes the
// 3 short sound effects once, and exposes init/play/volume. Every entry
// point is wrapped defensively so a missing/broken audio device, a browser
// without Web Audio, or a synthesis failure degrades to a silent no-op
// instead of ever interrupting a training session.
import { synthesizeShoot, synthesizeHit, synthesizeOnTargetTick } from './soundSynth.js'
import { SoundPool } from './soundPool.js'
import { loadTrainerAudioSettings } from './trainerAudioSettings.js'

let state = null // { context, masterGain, pools: { shoot, hit, tick } }
let unavailable = false

function getAudioContextClass() {
  if (typeof window === 'undefined') return null
  return window.AudioContext || window.webkitAudioContext || null
}

function bufferFromSamples(context, samples, sampleRate) {
  const buffer = context.createBuffer(1, samples.length, sampleRate)
  buffer.copyToChannel(samples, 0)
  return buffer
}

function applyVolume(volume0to100) {
  if (!state) return
  const v = Math.min(100, Math.max(0, Number(volume0to100) || 0)) / 100
  state.masterGain.gain.value = v
}

// Call from a genuine user gesture — the same click that requests pointer
// lock. Safe to call repeatedly: later calls just resume a suspended
// context (e.g. after the window lost focus). Never throws.
export function initTrainerAudio() {
  if (unavailable) return
  try {
    if (state) {
      if (state.context.state === 'suspended') state.context.resume().catch(() => {})
      return
    }
    const AudioContextClass = getAudioContextClass()
    if (!AudioContextClass) { unavailable = true; return }

    const context = new AudioContextClass()
    const masterGain = context.createGain()
    masterGain.connect(context.destination)

    const sampleRate = context.sampleRate
    const shootBuffer = bufferFromSamples(context, synthesizeShoot(sampleRate), sampleRate)
    const hitBuffer = bufferFromSamples(context, synthesizeHit(sampleRate), sampleRate)
    const tickBuffer = bufferFromSamples(context, synthesizeOnTargetTick(sampleRate), sampleRate)

    state = {
      context,
      masterGain,
      pools: {
        shoot: new SoundPool(context, shootBuffer, masterGain),
        hit: new SoundPool(context, hitBuffer, masterGain),
        tick: new SoundPool(context, tickBuffer, masterGain, { maxVoices: 2 }),
      },
    }
    applyVolume(loadTrainerAudioSettings().volume)
    if (context.state === 'suspended') context.resume().catch(() => {})
  } catch (err) {
    unavailable = true
    state = null
    console.warn('[trainerAudio] audio unavailable, continuing without sound', err)
  }
}

export function isTrainerAudioAvailable() {
  return !!state
}

export function setTrainerAudioVolume(volume0to100) {
  applyVolume(volume0to100)
}

function play(poolName) {
  if (!state) return
  try {
    const settings = loadTrainerAudioSettings()
    if (!settings.sfxEnabled) return
    state.pools[poolName].play(1)
  } catch (err) {
    console.warn(`[trainerAudio] failed to play "${poolName}"`, err)
  }
}

export function playShoot() { play('shoot') }
export function playHit() { play('hit') }

export function playOnTargetTick() {
  if (!state) return
  try {
    const settings = loadTrainerAudioSettings()
    if (!settings.sfxEnabled || !settings.onTargetTickEnabled) return
    state.pools.tick.play(1)
  } catch (err) {
    console.warn('[trainerAudio] failed to play "tick"', err)
  }
}

// Resume playback once the window/tab regains focus — a suspended context
// otherwise silently drops audio (never throws) until something resumes it.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state?.context.state === 'suspended') {
      state.context.resume().catch(() => {})
    }
  })
}

// Test-only: resets the module singleton between node:test cases.
export function __resetTrainerAudioForTests() {
  state = null
  unavailable = false
}
