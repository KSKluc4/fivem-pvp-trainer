import { useState } from 'react'
import {
  Container, Box, Group, Stack, Title, Text, Button, Card, SimpleGrid, Badge,
  RingProgress, ThemeIcon, Divider,
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

// One accent color per drill (theme tokens only — brandCyan/brandPurple are
// custom theme colors, orange/green are standard Mantine ones already used
// elsewhere in the app, e.g. Progress.jsx's StatCard) — just enough visual
// variety to tell the 4 cards apart at a glance.
const EXERCISE_COLORS = {
  tracking_suave: 'brandCyan',
  shot_grid:      'orange',
  quick_flick:    'brandPurple',
  micro_adjust:   'green',
}

function bestScoreFor(scores) {
  if (!scores || scores.length === 0) return null
  return scores.reduce((best, s) => (best == null || s.score > best ? s.score : best), null)
}

// Trainer entry point — a selection screen with one card per exercise
// (Tracking Suave from Phase 1 + the 3 Phase 2 drills), an overall aim
// level header, and an optional `initialHint` (exercise + difficulty, plus
// optionally rounds + exerciseName) that skips straight to ExercisePlayer —
// used by the daily routine's per-card "Treinar" deep-link.
export default function TrainerView({ onBack, initialHint = null, onRoutineComplete }) {
  const { t } = useTranslation()
  const { scoresByExercise, loading } = useAllTrainerScores()
  const [selection, setSelection] = useState(
    initialHint?.exercise ? { exercise: initialHint.exercise, difficulty: initialHint.difficulty } : null,
  )

  if (selection) {
    // Only a routine deep-link (initialHint) carries `rounds`/`exerciseName`
    // — free play from the selection grid below has neither, so
    // ExercisePlayer just loops rounds manually with no auto-return.
    const isHintedSelection = initialHint?.exercise === selection.exercise
    const targetRounds  = isHintedSelection ? initialHint.rounds : null
    const exerciseName  = isHintedSelection ? (initialHint.exerciseName || initialHint.exercise) : null

    return (
      <ExercisePlayer
        exerciseId={selection.exercise}
        initialDifficulty={selection.difficulty}
        targetRounds={targetRounds}
        onBack={() => setSelection(null)}
        onRoutineComplete={targetRounds ? () => onRoutineComplete?.(exerciseName) : undefined}
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

  const levelCaption = loading
    ? '…'
    : overall == null
      ? t('trainer.nivel_aim.sem_dados')
      : atMaxLevel
        ? t('trainer.nivel_aim.nivel_maximo')
        : t('trainer.nivel_aim.proximo', { level: flooredLevel + 1 })

  return (
    <Container size={1100} px="xl" py="xl">
      {/* ── Header ── */}
      <Group justify="space-between" align="center" mb="xl" wrap="wrap" gap="md">
        <Stack gap={2}>
          <Title order={1}>{t('trainer.titulo')}</Title>
          <Text c="dimmed" size="md">{t('trainer.selecionar_subtitulo')}</Text>
        </Stack>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('trainer.voltar')}
        </Button>
      </Group>

      {/* ── Overall aim level ── */}
      <Card p="xl" mb="xl">
        <Group justify="space-between" wrap="nowrap" gap="xl">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={56} radius="xl" variant="light" color="brandCyan">
              <IconChartLine size={30} />
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Text fw={700} size="lg">{t('trainer.nivel_aim.titulo')}</Text>
              <Text size="sm" c="dimmed">{levelCaption}</Text>
            </Box>
          </Group>
          <RingProgress
            size={100}
            thickness={10}
            roundCaps
            sections={overall != null ? [{ value: atMaxLevel ? 100 : progressPct, color: 'brandCyan' }] : []}
            label={
              <Text ta="center" fw={900} size="1.4rem" c={overall != null ? undefined : 'dimmed'}>
                {overall != null ? flooredLevel : '?'}
              </Text>
            }
          />
        </Group>
      </Card>

      {/* ── Drill selection ── */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {EXERCISE_IDS.map((exerciseId) => {
          const Icon = EXERCISE_ICONS[exerciseId]
          const color = EXERCISE_COLORS[exerciseId]
          const scores = scoresByExercise[exerciseId] || []
          const best = bestScoreFor(scores)
          const lastDifficulty = scores[0]?.difficulty || null

          return (
            <Card
              key={exerciseId}
              p="xl"
              className="trainer-select-card"
              onClick={() => setSelection({ exercise: exerciseId, difficulty: lastDifficulty || 'medio' })}
              style={{ cursor: 'pointer' }}
            >
              <Group gap="md" wrap="nowrap" align="flex-start">
                <ThemeIcon size={44} radius="md" variant="light" color={color}>
                  <Icon size={24} />
                </ThemeIcon>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={600} size="lg">{t(`trainer.exercicios.${exerciseId}.nome`)}</Text>
                  <Text size="sm" c="dimmed" lh={1.5}>{t(`trainer.exercicios.${exerciseId}.descricao`)}</Text>
                </Box>
              </Group>
              <Divider my="md" />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {best != null ? t('trainer.card.recorde', { score: best }) : t('trainer.card.sem_tentativas')}
                </Text>
                {lastDifficulty && (
                  <Badge size="sm" variant="light" color={color}>{t(`trainer.dificuldades.${lastDifficulty}`)}</Badge>
                )}
              </Group>
            </Card>
          )
        })}
      </SimpleGrid>
    </Container>
  )
}
