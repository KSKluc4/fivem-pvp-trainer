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
    this._errorCount = 0
    this._totalMs = 0
    this._crossings = 0
    this._lastSign = null
    this._lagSumDeg = 0
  }

  update(dtMs, angularErrorDeg, lateralOffsetDeg) {
    this._errorSumDeg += angularErrorDeg
    this._errorCount += 1
    this._totalMs += dtMs
    this._lagSumDeg += lateralOffsetDeg

    if (Math.abs(lateralOffsetDeg) >= CROSS_NOISE_DEG) {
      const sign = Math.sign(lateralOffsetDeg)
      if (this._lastSign != null && sign !== this._lastSign) this._crossings += 1
      this._lastSign = sign
    }
  }

  get avgErrorDeg() {
    return this._errorCount > 0 ? this._errorSumDeg / this._errorCount : null
  }

  get crossingsPerSecond() {
    return this._totalMs > 0 ? this._crossings / (this._totalMs / 1000) : null
  }

  // Average SIGNED lateral offset — a persistent bias (rather than one that
  // cancels out over the round) means the crosshair spent more time trailing
  // the target on one side than the other, i.e. lagging behind (sens too low).
  get avgLagBiasDeg() {
    return this._errorCount > 0 ? this._lagSumDeg / this._errorCount : null
  }
}
