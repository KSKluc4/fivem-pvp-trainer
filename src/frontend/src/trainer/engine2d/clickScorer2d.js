// Hit/miss/reaction-time/streak scorer shared by every click-mode 2D drill
// — the 2D analogue of engine/clickTarget.js's ClickScorer. Unlike that one
// (whose bestStreakMs was always hardcoded to 0, kept only for result-shape
// parity with TrackingScorer), this tracks a REAL running/best hit-streak —
// the HUD's "streak atual" needs live data for every drill.
//
// `points` (default 1) lets center-weighted drills (bullseye rings) award
// more than one point per hit; for every other drill score === hits, same
// number as before points existed.
export class ClickScorer2D {
  constructor() {
    this.hits           = 0
    this.shotsFired      = 0
    this.pointsTotal     = 0
    this.reactionTimesMs = []
    this.currentStreak   = 0
    this.bestStreak      = 0
  }

  // reactionMs: how long the target had been alive when this shot was fired.
  registerShot(hit, reactionMs, points = 1) {
    this.shotsFired += 1
    if (hit) {
      this.hits += 1
      this.pointsTotal += points
      this.reactionTimesMs.push(reactionMs)
      this.currentStreak += 1
      if (this.currentStreak > this.bestStreak) this.bestStreak = this.currentStreak
    } else {
      this.currentStreak = 0
    }
  }

  get score() {
    return this.pointsTotal
  }

  get accuracyPct() {
    return this.shotsFired > 0 ? (this.hits / this.shotsFired) * 100 : 0
  }

  get avgReactionMs() {
    if (this.reactionTimesMs.length === 0) return 0
    return this.reactionTimesMs.reduce((a, b) => a + b, 0) / this.reactionTimesMs.length
  }
}

// Time-on-target scoring — ms spent with the cursor over the target, no
// click needed. Used by the continuous (tracking) mechanic. avgReactionMs
// is kept (always 0) so a session result has the same shape as
// ClickScorer2D's, letting ResultsScreen read either without branching.
export class TrackingScorer2D {
  constructor() {
    this.onTargetMs      = 0
    this.totalMs         = 0
    this.currentStreakMs = 0
    this.bestStreakMs    = 0
    this.avgReactionMs   = 0
  }

  update(dtMs, isOnTarget) {
    this.totalMs += dtMs
    if (isOnTarget) {
      this.onTargetMs += dtMs
      this.currentStreakMs += dtMs
      if (this.currentStreakMs > this.bestStreakMs) this.bestStreakMs = this.currentStreakMs
    } else {
      this.currentStreakMs = 0
    }
  }

  get score() {
    return Math.round(this.onTargetMs)
  }

  get accuracyPct() {
    return this.totalMs > 0 ? (this.onTargetMs / this.totalMs) * 100 : 0
  }
}
