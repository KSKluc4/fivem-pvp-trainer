import { ActionIcon } from '@mantine/core'
import { IconVolume2, IconVolumeOff } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// Left: drill name + points. Center: time remaining + progress bar. Right:
// accuracy% + current streak. Bottom-right of the play area: quick mute
// button. `streak` is milliseconds for the continuous drill (Tracking
// Suave) or a hit count for the 3 click-mode drills — `mode` picks the
// right formatting.
export default function Hud({
  exerciseName, score, timeLeft, sessionDurationS, accuracyPct,
  accuracyLabelKey = 'trainer.na_mira', streak = 0, mode = 'click',
  sfxOn = true, onToggleMute,
}) {
  const { t } = useTranslation()
  const progressPct = sessionDurationS > 0
    ? Math.max(0, Math.min(100, (timeLeft / sessionDurationS) * 100))
    : 0
  const streakLabel = mode === 'continuous' ? `${(streak / 1000).toFixed(1)}s` : `×${streak}`

  return (
    <>
      <div style={{
        position: 'absolute', top: 16, left: 16, color: '#e8e8f0',
        fontFamily: 'monospace', textShadow: '0 1px 4px rgba(0,0,0,0.6)', maxWidth: '35%',
      }}>
        <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {exerciseName}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{score}</div>
      </div>

      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', color: '#e8e8f0', fontFamily: 'monospace',
        textShadow: '0 1px 4px rgba(0,0,0,0.6)', minWidth: 140,
      }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{String(Math.ceil(timeLeft)).padStart(2, '0')}s</div>
        <div className="trainer-progress-track">
          <div className="trainer-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 16, right: 16, textAlign: 'right',
        color: '#e8e8f0', fontFamily: 'monospace', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{accuracyPct.toFixed(1)}%</div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>{t(accuracyLabelKey)}</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          {streakLabel} {t('trainer.hud.sequencia')}
        </div>
      </div>

      <ActionIcon
        className="trainer-mute-btn"
        variant="light"
        color="gray"
        radius="xl"
        size="lg"
        onClick={onToggleMute}
        aria-label={t('trainer.imersao.sons_treino')}
      >
        {sfxOn ? <IconVolume2 size={18} /> : <IconVolumeOff size={18} />}
      </ActionIcon>
    </>
  )
}
