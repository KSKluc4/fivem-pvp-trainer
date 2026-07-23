// Tiny shared numeric helpers for the sensitivity-discovery metrics —
// deliberately dependency-free so flickAnalysis/trackingAnalysis/verdict
// stay pure and trivially unit-testable.

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

// Standard median-of-sorted-copy — robust to the outlier shots/rounds that
// any single flick/tracking attempt can produce (a missed timeout, a wild
// mouse bump), which is exactly why the spec calls for medians over means.
export function median(values) {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
