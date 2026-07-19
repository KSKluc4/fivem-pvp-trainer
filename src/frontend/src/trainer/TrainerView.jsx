import { useState } from 'react'
import {
  Box, Group, Stack, Title, Text, Button, Card, SimpleGrid, Badge, Progress as MProgress,
} from '@mantine/core'
import {
  IconArrowLeft, IconFocus2, IconGrid3x3, IconBolt, IconAdjustments, IconChartLine,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import ExercisePlayer from './ExercisePlayer'
import { useAllTrainerScores } from './useAllTrainerScores'
import { EXERCISE_IDS } from './scenarios/index.js'
import { exerciseAimLevel, overallAimLevel, MAX_LEVEL } from './aimLevel.js'
import './trainer.css'

const EXERCISE_ICONS = {
  tracking_suave: IconFocus2,
  shot_grid:      IconGrid3x3,
  quick_flick:    IconBolt,
  micro_adjust:   IconAdjustments,
}

function bestScoreFor(scores) {
  if (!scores || scores.length === 0) return null
  return scores.reduce((best, s) => (best == null || s.score > best ? s.score : best), null)
}

// Trainer entry point — a selection screen with one card per exercise
// (Tracking Suave from Phase 1 + the 3 Phase 2 drills), an overall aim
// level header, and an optional `initialHint` (exercise + difficulty) that
// skips straight to ExercisePlayer — used by the daily routine's "Train
// in-app" recommendation.
export default function TrainerView({ onBack, initialHint = null }) {
  const { t } = useTranslation()
  const { scoresByExercise, loading } = useAllTrainerScores()
  const [selection, setSelection] = useState(
    initialHint?.exercise ? { exercise: initialHint.exercise, difficulty: initialHint.difficulty } : null,
  )

  if (selection) {
    return (
      <ExercisePlayer
        exerciseId={selection.exercise}
        initialDifficulty={selection.difficulty}
        onBack={() => setSelection(null)}
      />
    )
  }

  const perExerciseLevels = Object.fromEntries(
    EXERCISE_IDS.map((id) => [id, exerciseAimLevel(scoresByExercise[id] || [])]),
  )
  const overall = overallAimLevel(perExerciseLevels)
  const flooredLevel = overall != null ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(overall))) : null
  const progressPct  = overall != null ? Math.min(100, (overall - flooredLevel) * 100) : 0
  const atMaxLevel    = flooredLevel === MAX_LEVEL

  return (
    <Box className="trainer-view">
      <Group justify="space-between" mb="md">
        <Group gap={6}>
          <Title order={1} size="h2">{t('trainer.titulo')}</Title>
          <Text c="dimmed" size="sm">{t('trainer.selecionar_subtitulo')}</Text>
        </Group>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('trainer.voltar')}
        </Button>
      </Group>

      <Card mb="lg">
        <Group gap={6} mb="xs">
          <IconChartLine size={18} color="var(--mantine-color-brandCyan-5)" />
          <Text fw={700} size="sm">{t('trainer.nivel_aim.titulo')}</Text>
        </Group>
        {loading ? (
          <Text size="sm" c="dimmed">…</Text>
        ) : overall == null ? (
          <Text size="sm" c="dimmed">{t('trainer.nivel_aim.sem_dados')}</Text>
        ) : (
          <>
            <Group justify="space-between" mb={6}>
              <Badge size="lg" variant="light" color="brandCyan">{t('trainer.nivel_aim.nivel', { level: flooredLevel })}</Badge>
              <Text size="xs" c="dimmed">
                {atMaxLevel ? t('trainer.nivel_aim.nivel_maximo') : t('trainer.nivel_aim.proximo', { level: flooredLevel + 1 })}
              </Text>
            </Group>
            <MProgress value={atMaxLevel ? 100 : progressPct} radius="xl" size="lg" />
          </>
        )}
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {EXERCISE_IDS.map((exerciseId) => {
          const Icon = EXERCISE_ICONS[exerciseId]
          const scores = scoresByExercise[exerciseId] || []
          const best = bestScoreFor(scores)
          const lastDifficulty = scores[0]?.difficulty || null

          return (
            <Card
              key={exerciseId}
              withBorder
              className="trainer-select-card"
              onClick={() => setSelection({ exercise: exerciseId, difficulty: lastDifficulty || 'medio' })}
              style={{ cursor: 'pointer' }}
            >
              <Group gap="sm" mb={6} wrap="nowrap">
                <Icon size={26} color="var(--mantine-color-brandCyan-5)" />
                <Box style={{ minWidth: 0 }}>
                  <Text fw={800}>{t(`trainer.exercicios.${exerciseId}.nome`)}</Text>
                  <Text size="xs" c="dimmed">{t(`trainer.exercicios.${exerciseId}.descricao`)}</Text>
                </Box>
              </Group>
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">
                  {best != null ? t('trainer.card.recorde', { score: best }) : t('trainer.card.sem_tentativas')}
                </Text>
                {lastDifficulty && (
                  <Badge size="xs" variant="light">{t(`trainer.dificuldades.${lastDifficulty}`)}</Badge>
                )}
              </Group>
            </Card>
          )
        })}
      </SimpleGrid>
    </Box>
  )
}
