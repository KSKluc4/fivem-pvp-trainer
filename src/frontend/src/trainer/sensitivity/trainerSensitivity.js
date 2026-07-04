// Trainer-specific sensitivity settings. Phase 1 keeps this entirely local
// (localStorage) rather than adding a backend column/migration for it — the
// GTA sens + DPI are already persisted server-side by the existing
// sensitivity converter (sensitivity_conversions table); the trainer only
// needs a place to remember which of those values to use, plus a personal
// fine-tune multiplier that has no equivalent anywhere else.
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

export function saveTrainerSensSettings(settings) {
  const merged = { ...loadTrainerSensSettings(), ...settings }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Storage unavailable (private mode, quota) — setting still applies for
    // this session via the returned object, just won't persist.
  }
  return merged
}

// Effective degrees-per-raw-mouse-count for the trainer's camera: the exact
// GTA V response (same formula the sensitivity converter uses), scaled by
// the user's own fine-tune adjustment.
export function effectiveDegPerCount(settings) {
  const base = degPerCountFromGtaSens(settings.gtaSens ?? 0)
  return base * (settings.fineTuneMultiplier ?? 1)
}
