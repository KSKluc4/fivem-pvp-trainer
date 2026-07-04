export const CROSSHAIR_STYLES = ['cross', 'dot', 'cross-dot']

export default function Crosshair({ style = 'cross-dot', color = '#00d4ff' }) {
  const showCross = style === 'cross' || style === 'cross-dot'
  const showDot   = style === 'dot' || style === 'cross-dot'
  const gap = style === 'cross-dot' ? 4 : 0

  return (
    <div
      style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        width: 22, height: 22,
      }}
    >
      {showCross && (
        <>
          <div style={{ position: 'absolute', top: '50%', left: 0, width: `calc(50% - ${gap}px)`, height: 2, background: color, transform: 'translateY(-1px)' }} />
          <div style={{ position: 'absolute', top: '50%', right: 0, width: `calc(50% - ${gap}px)`, height: 2, background: color, transform: 'translateY(-1px)' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, height: `calc(50% - ${gap}px)`, width: 2, background: color, transform: 'translateX(-1px)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: 0, height: `calc(50% - ${gap}px)`, width: 2, background: color, transform: 'translateX(-1px)' }} />
        </>
      )}
      {showDot && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: 5, height: 5,
          borderRadius: '50%', background: color, transform: 'translate(-50%, -50%)',
        }} />
      )}
    </div>
  )
}
