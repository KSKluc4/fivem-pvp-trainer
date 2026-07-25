// Hit/miss/reaction-time/streak scorer shared by the 3 click-mode 2D drills
// (Grade de Tiro / Flick Rápido / Micro Ajuste) — the 2D analogue of
// engine/clickTarget.js's ClickScorer. Unlike that one (whose bestStreakMs
// was always hardcoded to 0, kept only for result-shape parity with
// TrackingScorer), this tracks a REAL running/best hit-streak — the new
// HUD's "streak atual" needs live data for every drill, not just Tracking.
export class ClickScorer2D {
  constructor() {
    this.hits           = 0
    this.shotsFired      = 0
    this.reactionTimesMs = []
    this.currentStreak   = 0
    this.bestStreak      = 0
  }

  // reactionMs: how long the target had been alive when this shot was fired.
  registerShot(hit, reactionMs) {
    this.shotsFired += 1
    if (hit) {
      this.hits += 1
      this.reactionTimesMs.push(reactionMs)
      this.currentStreak += 1
      if (this.currentStreak > this.bestStreak) this.bestStreak = this.currentStreak
    } else {
      this.currentStreak = 0
    }
  }

  get score() {
    return this.hits
  }

  get accuracyPct() {
    return this.shotsFired > 0 ? (this.hits / this.shotsFired) * 100 : 0
  }

  get avgReactionMs() {
    if (this.reactionTimesMs.length === 0) return 0
    return this.reactionTimesMs.reduce((a, b) => a + b, 0) / this.reactionTimesMs.length
  }
}
