import test from 'node:test'
import assert from 'node:assert/strict'

// Node has no localStorage global by default — install a minimal in-memory
// stand-in before importing the module under test (it reads `localStorage`
// as a bare global at call time, so definition order here doesn't matter).
function installFakeLocalStorage() {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
  return globalThis.localStorage
}

const {
  loadTrainerAudioSettings,
  saveTrainerAudioSettings,
} = await import('./trainerAudioSettings.js')

test('loadTrainerAudioSettings returns defaults when nothing stored', () => {
  installFakeLocalStorage()
  const settings = loadTrainerAudioSettings()
  assert.equal(settings.volume, 50)
  assert.equal(settings.sfxEnabled, true)
  assert.equal(settings.showWeapon, true)
  assert.equal(settings.onTargetTickEnabled, false)
})

test('saveTrainerAudioSettings persists and merges with existing values', () => {
  installFakeLocalStorage()
  saveTrainerAudioSettings({ volume: 80 })
  saveTrainerAudioSettings({ sfxEnabled: false })
  const settings = loadTrainerAudioSettings()
  assert.equal(settings.volume, 80)
  assert.equal(settings.sfxEnabled, false)
  assert.equal(settings.showWeapon, true) // untouched field stays default
})

test('volume is clamped to 0-100 on save', () => {
  installFakeLocalStorage()
  saveTrainerAudioSettings({ volume: 150 })
  assert.equal(loadTrainerAudioSettings().volume, 100)
  saveTrainerAudioSettings({ volume: -20 })
  assert.equal(loadTrainerAudioSettings().volume, 0)
})

test('volume is clamped to 0-100 on load too, for values written by a future/other version', () => {
  const storage = installFakeLocalStorage()
  storage.setItem('trainer_audio_settings_v1', JSON.stringify({ volume: 999 }))
  assert.equal(loadTrainerAudioSettings().volume, 100)
})

test('corrupt JSON in storage falls back to defaults instead of throwing', () => {
  const storage = installFakeLocalStorage()
  storage.setItem('trainer_audio_settings_v1', '{not valid json')
  assert.doesNotThrow(() => loadTrainerAudioSettings())
  assert.deepEqual(loadTrainerAudioSettings(), {
    volume: 50, sfxEnabled: true, showWeapon: true, onTargetTickEnabled: false,
  })
})

test('missing localStorage global does not throw (e.g. private-mode edge cases)', () => {
  const prev = globalThis.localStorage
  delete globalThis.localStorage
  assert.doesNotThrow(() => loadTrainerAudioSettings())
  assert.doesNotThrow(() => saveTrainerAudioSettings({ volume: 10 }))
  globalThis.localStorage = prev
})
