// Tracks the free mouse cursor inside the 2D drill canvas and draws the
// small crosshair marker that replaces the system pointer (hidden via CSS
// while a session is active). Position is kept in a plain mutable object,
// never React state — pointermove fires far more often than any sane
// render budget, this must never trigger a re-render.
export function createCursorTracker(canvas) {
  const pos = { x: 0, y: 0 }

  function syncFromEvent(e) {
    const rect = canvas.getBoundingClientRect()
    pos.x = Math.min(rect.width, Math.max(0, e.clientX - rect.left))
    pos.y = Math.min(rect.height, Math.max(0, e.clientY - rect.top))
  }

  function attach() {
    canvas.addEventListener('pointermove', syncFromEvent)
  }

  function detach() {
    canvas.removeEventListener('pointermove', syncFromEvent)
  }

  // getPosition() alone reflects wherever the last pointermove landed, which
  // is stale for a pointerdown that isn't preceded by a move at the same
  // spot (synthetic/programmatic clicks, some touch/pen input). Callers that
  // hit-test a click must syncFromEvent(e) with the pointerdown event first.
  function getPosition() {
    return pos
  }

  // `style` mirrors hud/Crosshair.jsx's CROSSHAIR_STYLES ('cross' | 'dot' |
  // 'cross-dot') so the setup screen's existing picker still applies.
  function draw(ctx, style = 'cross-dot') {
    const { x, y } = pos
    ctx.save()
    ctx.shadowColor   = 'rgba(0, 212, 255, 0.85)'
    ctx.shadowBlur    = 6
    ctx.strokeStyle   = '#e8e8f0'
    ctx.fillStyle     = '#e8e8f0'
    ctx.lineWidth     = 1.5

    if (style !== 'dot') {
      const len = 7, gap = 3
      ctx.beginPath()
      ctx.moveTo(x - len - gap, y); ctx.lineTo(x - gap, y)
      ctx.moveTo(x + gap, y);       ctx.lineTo(x + len + gap, y)
      ctx.moveTo(x, y - len - gap); ctx.lineTo(x, y - gap)
      ctx.moveTo(x, y + gap);       ctx.lineTo(x, y + len + gap)
      ctx.stroke()
    }
    if (style !== 'cross') {
      ctx.beginPath()
      ctx.arc(x, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  return { attach, detach, getPosition, syncFromEvent, draw }
}
