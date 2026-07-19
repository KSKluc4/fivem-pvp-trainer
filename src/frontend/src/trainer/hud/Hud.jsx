import { useTranslation } from 'react-i18next'

export default function Hud({ timeLeft, score, accuracyPct, fps, accuracyLabelKey = 'trainer.na_mira' }) {
  const { t } = useTranslation()
  return (
    <>
      <div style={{
        position: 'absolute', top: 16, left: 16, color: '#e8e8f0',
        fontWeight: 800, fontSize: 26, fontFamily: 'monospace', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      }}>
        {String(Math.ceil(timeLeft)).padStart(2, '0')}s
      </div>

      <div style={{
        position: 'absolute', top: 16, right: 16, fontSize: 11,
        color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
      }}>
        {fps} FPS
      </div>

      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', color: '#e8e8f0', fontFamily: 'monospace',
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{score}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{accuracyPct.toFixed(1)}% {t(accuracyLabelKey)}</div>
      </div>
    </>
  )
}
