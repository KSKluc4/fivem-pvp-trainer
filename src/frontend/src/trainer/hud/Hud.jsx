import { ActionIcon, Badge, Divider, Group, Text } from '@mantine/core'
import { IconVolume2, IconVolumeOff, IconPlayerPause } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { CATEGORY_COLORS } from '../engine2d/theme2d.js'

// The in-session HUD — a real bar OUTSIDE the playable canvas (rendered as
// a sibling above it, see ExercisePlayer/trainer.css's .drill-hud-bar), not
// an overlay on top of it. That separation is load-bearing: this used to be
// absolutely-positioned text floating over the canvas, which silently ate
// pointerdown/pointermove events for any target unlucky enough to spawn
// behind it — a target there couldn't be clicked (or even hovered, for the
// tracking mechanic), quietly corrupting score/accuracy/aim-level data.
//
// Three content blocks (left/center/right) plus a small mute+pause control
// cluster — never touching the field, per the same separation.
export default function Hud({
  exerciseName, category, score, timeLeft, sessionDurationS, accuracyPct,
  accuracyLabelKey = 'trainer.na_mira', streak = 0, mode = 'click',
  sfxOn = true, onToggleMute, onPause,
}) {
  const { t } = useTranslation()
  const progressPct = sessionDurationS > 0
    ? Math.max(0, Math.min(100, (timeLeft / sessionDurationS) * 100))
    : 0
  const streakLabel = mode === 'continuous' ? `${(streak / 1000).toFixed(1)}s` : `×${streak}`
  const accentColor = CATEGORY_COLORS[category] ?? 'brandCyan'

  return (
    <div className="drill-hud-bar">
      <div className="drill-hud-block drill-hud-block--left">
        <Group gap={10} wrap="nowrap">
          <Badge size="sm" variant="light" color={accentColor} className="drill-hud-badge">
            {t(`trainer.categorias.${category}`)}
          </Badge>
          <div style={{ minWidth: 0 }}>
            <Text size="10px" c="dimmed" truncate className="drill-hud-label">{exerciseName}</Text>
            <Text fw={800} c={accentColor} className="tabular-nums drill-hud-score" lh={1.1}>
              {score}
            </Text>
          </div>
        </Group>
      </div>

      <div className="drill-hud-block drill-hud-block--center">
        <Text fw={800} size="1.7rem" className="tabular-nums" lh={1.1}>
          {String(Math.ceil(timeLeft)).padStart(2, '0')}s
        </Text>
        <div className="trainer-progress-track">
          <div className="trainer-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="drill-hud-block drill-hud-block--right">
        <Group gap={18} wrap="nowrap" align="center">
          <div style={{ textAlign: 'right' }}>
            <Text fw={800} size="1.05rem" className="tabular-nums" lh={1.1}>{accuracyPct.toFixed(1)}%</Text>
            <Text size="10px" c="dimmed" className="drill-hud-label">{t(accuracyLabelKey)}</Text>
          </div>
          <div style={{ textAlign: 'right' }} className="drill-hud-streak">
            <Text fw={700} size="0.95rem" className="tabular-nums" lh={1.1}>{streakLabel}</Text>
            <Text size="10px" c="dimmed" className="drill-hud-label">{t('trainer.hud.sequencia')}</Text>
          </div>
          <Divider orientation="vertical" className="drill-hud-divider" />
          <Group gap={2} wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="xl"
              onClick={onPause}
              aria-label={t('trainer.pausar')}
            >
              <IconPlayerPause size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="xl"
              onClick={onToggleMute}
              aria-label={t('trainer.imersao.sons_treino')}
            >
              {sfxOn ? <IconVolume2 size={16} /> : <IconVolumeOff size={16} />}
            </ActionIcon>
          </Group>
        </Group>
      </div>
    </div>
  )
}
