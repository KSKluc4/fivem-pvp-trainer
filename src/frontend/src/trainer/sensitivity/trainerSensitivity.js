// Trainer-specific sensitivity settings. The user's GTA sens + DPI are now a
// single profile-wide value shared with "Minha Sensibilidade" and persisted
// on the backend (users.gta_sensitivity/dpi/fine_tune_multiplier) — this
// module keeps a localStorage mirror purely so the trainer can read it
// synchronously on mount (no network round-trip before the WebGL canvas can
// start) and still work offline. The backend stays the source of truth:
// App.jsx writes through to this cache on every login/boot, and every save
// here (from either screen) pushes to the backend too — see syncFromServer.
import { degPerCountFromGtaSens } from '../../services/sensitivityMath.js'

const STORAGE_KEY = 'trainer_sens_settings_v1'

const DEFAULTS = {
  gtaSens:           null, // null until the user sets it (first-run prompt)
  dpi:               800,
  fineTuneMultiplier: 1.0, // 0.5–1.5, applied on top of the GTA-derived value
}

export function loadTrainerSensSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeLocal(settings) {
  const merged = { ...loadTrainerSensSettings(), ...settings }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Storage unavailable (private mode, quota) — setting still applies for
    // this session via the returned object, just won't persist.
  }
  return merged
}

// Saves locally first (instant, always succeeds) then best-effort pushes to
// the backend so it's available on other devices/after clearing storage.
// Lazily imports services/api.js (rather than a static import) so this module
// stays a plain, dependency-free unit importable from node:test — see
// trainerSensitivity.test.mjs, which only ever exercises the pure math below.
export function saveTrainerSensSettings(settings) {
  const merged = writeLocal(settings)
  import('../../services/api.js').then(({ updateSensitivity }) => updateSensitivity({
    gta_sensitivity:      merged.gtaSens,
    dpi:                  merged.dpi,
    fine_tune_multiplier: merged.fineTuneMultiplier,
  })).catch(() => {})
  return merged
}

// Called once the server's copy of the user is known (login/refresh/boot) —
// mirrors it into the local cache so the trainer's synchronous read is fresh
// even on a device that's never opened the trainer before. Never overwrites
// a local value with an absent server one (e.g. a brand new account that
// hasn't configured sensitivity anywhere yet).
export function syncTrainerSensFromServer(user) {
  if (user?.gta_sensitivity == null) return
  writeLocal({
    gtaSens:            user.gta_sensitivity,
    dpi:                user.dpi ?? DEFAULTS.dpi,
    fineTuneMultiplier: user.fine_tune_multiplier ?? DEFAULTS.fineTuneMultiplier,
  })
}

// Effective degrees-per-raw-mouse-count for the trainer's camera: the exact
// GTA V response (same formula the sensitivity converter uses), scaled by
// the user's own fine-tune adjustment.
export function effectiveDegPerCount(settings) {
  const base = degPerCountFromGtaSens(settings.gtaSens ?? 0)
  return base * (settings.fineTuneMultiplier ?? 1)
}
