// Per-round accumulator for the "Tracking Suave" variation of the
// sensitivity-discovery test. Fed one sample per rendered frame while the
// round plays:
//   - angularErrorDeg: unsigned angle (degrees) between the camera's forward
//     direction and the vector to the target's center this frame.
//   - lateralOffsetDeg: SIGNED horizontal angle (degrees) of the target
//     relative to screen center — used only to detect the crosshair
//     crossing the target's line of travel. High-frequency sign flips read
//     as oscillation (sens too high); a lateral offset that stays on one
//     side reads as persistent lag (sens too low) — see verdict.js.
//
// Sign flips smaller than CROSS_NOISE_DEG are ignored — otherwise pure
// sub-pixel jitter around zero would register as constant "crossing".
const CROSS_NOISE_DEG = 0.3

export class TrackingDiscoveryScorer {
  constructor() {
    this._errorSumDeg = 0
    this._totalMs = 0
    this._crossings = 0
    this._lastSign = null
    this._lagSumDeg = 0
  }

  update(dtMs, angularErrorDeg, lateralOffsetDeg) {
    // Weighted by dtMs (the real time this sample represents), not just
    // counted per-call — under uneven/low FPS, frames aren't evenly spaced,
    // so an unweighted mean would skew toward whichever moments happened to
    // render more frames rather than toward the actual time spent there.
    // crossingsPerSecond already avoided this (it's a rate over _totalMs);
    // avgErrorDeg/avgLagBiasDeg previously didn't.
    this._errorSumDeg += angularErrorDeg * dtMs
    this._totalMs += dtMs
    this._lagSumDeg += lateralOffsetDeg * dtMs

    if (Math.abs(lateralOffsetDeg) >= CROSS_NOISE_DEG) {
      const sign = Math.sign(lateralOffsetDeg)
      if (this._lastSign != null && sign !== this._lastSign) this._crossings += 1
      this._lastSign = sign
    }
  }

  get totalMs() {
    return this._totalMs
  }

  get avgErrorDeg() {
    return this._totalMs > 0 ? this._errorSumDeg / this._totalMs : null
  }

  get crossingsPerSecond() {
    return this._totalMs > 0 ? this._crossings / (this._totalMs / 1000) : null
  }

  // Average SIGNED lateral offset — a persistent bias (rather than one that
  // cancels out over the round) means the crosshair spent more time trailing
  // the target on one side than the other, i.e. lagging behind (sens too low).
  get avgLagBiasDeg() {
    return this._totalMs > 0 ? this._lagSumDeg / this._totalMs : null
  }
}
