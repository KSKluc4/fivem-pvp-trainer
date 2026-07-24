// Persisted "minimal immersion" settings — weapon viewmodel + drill sound
// effects. Deliberately localStorage-only (no backend sync), same as the
// crosshair style choice, just persisted across sessions: purely cosmetic,
// doesn't need to follow the user across devices. Mirrors the load/save
// shape of ../sensitivity/trainerSensitivity.js.
const STORAGE_KEY = 'trainer_audio_settings_v1'

const DEFAULTS = {
  volume:              50,    // 0-100
  sfxEnabled:           true,  // "Sons do treino"
  showWeapon:           true,  // "Mostrar arma"
  // Tracking Suave's subtle on-target tick — off by default per spec, no UI
  // toggle exposed yet; kept as a settings field so it's one flip away.
  onTargetTickEnabled:  false,
}

function clampVolume(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULTS.volume
  return Math.min(100, Math.max(0, n))
}

export function loadTrainerAudioSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULTS,
      ...parsed,
      volume: clampVolume(parsed.volume ?? DEFAULTS.volume),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveTrainerAudioSettings(settings) {
  const merged = { ...loadTrainerAudioSettings(), ...settings }
  if (settings.volume != null) merged.volume = clampVolume(settings.volume)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Storage unavailable (private mode, quota) — setting still applies for
    // this session via the returned object, just won't persist.
  }
  return merged
}
