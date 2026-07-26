import { useState } from 'react'
import {
  Container, Box, Group, Stack, Title, Text, Button, Card, SimpleGrid, Badge,
  RingProgress, ThemeIcon, ActionIcon, Popover, Slider, Switch, SegmentedControl,
} from '@mantine/core'
import {
  IconArrowLeft, IconFocus2, IconGrid3x3, IconBolt, IconTargetArrow, IconStopwatch,
  IconCompass, IconSettings,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import ExercisePlayer from './ExercisePlayer'
import { useAllTrainerScores } from './useAllTrainerScores'
import { CATEGORIES, DRILLS, drillsInCategory } from './catalog.js'
import { perCategoryLevels, overallAimLevel, MAX_LEVEL } from './aimLevel.js'
import { loadTrainerAudioSettings, saveTrainerAudioSettings } from './audio/trainerAudioSettings.js'
import { setTrainerAudioVolume } from './audio/trainerAudio.js'
import './trainer.css'

// One icon + accent color per CATEGORY (theme tokens only — brandCyan/
// brandPurple are custom theme colors, the rest are standard Mantine ones
// already used elsewhere). Same 5 hues engine2d/theme2d.js sources the
// in-canvas target glow from, so a card's icon color and its drill's glow
// agree.
const CATEGORY_ICONS = {
  tracking:  IconFocus2,
  clicking:  IconGrid3x3,
  flicking:  IconBolt,
  precision: IconTargetArrow,
  reaction:  IconStopwatch,
}

export const CATEGORY_COLORS = {
  tracking:  'brandCyan',
  clicking:  'orange',
  flicking:  'brandPurple',
  precision: 'green',
  reaction:  'yellow',
}

function bestScoreFor(scores) {
  if (!scores || scores.length === 0) return null
  return scores.reduce((best, s) => (best == null || s.score > best ? s.score : best), null)
}

// Trainer entry point — category-filtered drill grid over the full catalog
// (trainer/catalog.js), with a compact overall-aim-level header, a gear
// popover holding the sound settings (the old "Imersão do treino" card),
// and an optional `initialHint` (exercise + difficulty, plus optionally
// rounds + exerciseName) that skips straight to ExercisePlayer — used by
// the daily routine's per-card "Treinar" deep-link.
export default function TrainerView({ onBack, initialHint = null, onRoutineComplete, onDescobrirSensibilidade }) {
  const { t } = useTranslation()
  const { scoresByExercise, loading } = useAllTrainerScores()
  const [selection, setSelection] = useState(
    initialHint?.exercise ? { exercise: initialHint.exercise, difficulty: initialHint.difficulty } : null,
  )
  const [categoryFilter, setCategoryFilter] = useState('todos')
  const [audioSettings, setAudioSettings] = useState(() => loadTrainerAudioSettings())

  const updateAudioSettings = (patch) => {
    const merged = saveTrainerAudioSettings(patch)
    setAudioSettings(merged)
    if (patch.volume != null) setTrainerAudioVolume(merged.volume)
  }

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

  const levelsByCategory = perCategoryLevels(scoresByExercise)
  const overall = overallAimLevel(levelsByCategory)
  const flooredLevel = overall != null ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(overall))) : null
  const progressPct  = overall != null ? Math.min(100, (overall - flooredLevel) * 100) : 0
  const atMaxLevel    = flooredLevel === MAX_LEVEL

  const selectedCategoryLevel = categoryFilter !== 'todos' ? levelsByCategory[categoryFilter] : null
  const visibleDrills = categoryFilter === 'todos' ? DRILLS : drillsInCategory(categoryFilter)

  return (
    <Container size={1240} px="xl" py="xl">
      {/* ── Header: title + compact overall level + sound gear ── */}
      <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="md">
        <Stack gap={2}>
          <Title order={1}>{t('trainer.titulo')}</Title>
          <Text c="dimmed" size="md">{t('trainer.selecionar_subtitulo')}</Text>
        </Stack>
        <Group gap="sm" wrap="nowrap">
          <Group gap={8} wrap="nowrap">
            <RingProgress
              size={48}
              thickness={5}
              roundCaps
              sections={overall != null ? [{ value: atMaxLevel ? 100 : progressPct, color: 'brandCyan' }] : []}
              label={
                <Text ta="center" fw={900} size="sm" c={overall != null ? undefined : 'dimmed'}>
                  {overall != null ? flooredLevel : '?'}
                </Text>
              }
            />
            <Box>
              <Text size="xs" fw={700} lh={1.2}>{t('trainer.nivel_aim.titulo')}</Text>
              <Text size="xs" c="dimmed" lh={1.2}>
                {loading
                  ? '…'
                  : overall == null
                    ? t('trainer.nivel_aim.sem_dados_curto')
                    : atMaxLevel
                      ? t('trainer.nivel_aim.nivel_maximo')
                      : t('trainer.nivel_aim.proximo', { level: flooredLevel + 1 })}
              </Text>
            </Box>
          </Group>
          <Popover width={260} position="bottom-end" shadow="md" withArrow>
            <Popover.Target>
              <ActionIcon variant="light" color="gray" size="lg" radius="md" aria-label={t('trainer.config.abrir')}>
                <IconSettings size={18} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Text fw={600} size="sm" mb="sm">{t('trainer.config.titulo')}</Text>
              <Group justify="space-between" mb={4}>
                <Text size="xs">{t('trainer.imersao.volume')}</Text>
                <Text size="xs" c="dimmed">{audioSettings.volume}%</Text>
              </Group>
              <Slider
                min={0}
                max={100}
                step={1}
                mb="md"
                value={audioSettings.volume}
                onChange={(v) => updateAudioSettings({ volume: v })}
                label={(v) => `${v}%`}
              />
              <Switch
                size="sm"
                label={t('trainer.imersao.sons_treino')}
                checked={audioSettings.sfxEnabled}
                onChange={(e) => updateAudioSettings({ sfxEnabled: e.currentTarget.checked })}
              />
            </Popover.Dropdown>
          </Popover>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            {t('trainer.voltar')}
          </Button>
        </Group>
      </Group>

      {/* ── Category filter ── */}
      <Group gap="sm" mb="lg" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={categoryFilter}
          onChange={setCategoryFilter}
          data={[
            { label: t('trainer.categorias.todos'), value: 'todos' },
            ...CATEGORIES.map((cat) => ({ label: t(`trainer.categorias.${cat}`), value: cat })),
          ]}
        />
        {categoryFilter !== 'todos' && (
          <Badge variant="light" color={CATEGORY_COLORS[categoryFilter]}>
            {selectedCategoryLevel != null
              ? t('trainer.nivel_aim.nivel', { level: selectedCategoryLevel })
              : t('trainer.categorias.sem_nivel')}
          </Badge>
        )}
      </Group>

      {/* ── Sensitivity discovery — a guided diagnostic test, not a scored drill ── */}
      {onDescobrirSensibilidade && (
        <Card p="md" mb="lg" className="trainer-select-card" onClick={onDescobrirSensibilidade} style={{ cursor: 'pointer' }}>
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={38} radius="md" variant="light" color="brandCyan">
              <IconCompass size={20} />
            </ThemeIcon>
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text fw={600} size="sm">{t('sensibilidade.descoberta.card_titulo')}</Text>
              <Text size="xs" c="dimmed" lineClamp={1}>{t('sensibilidade.descoberta.card_descricao')}</Text>
            </Box>
          </Group>
        </Card>
      )}

      {/* ── Drill grid ── */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
        {visibleDrills.map((drill) => {
          const Icon  = CATEGORY_ICONS[drill.category]
          const color = CATEGORY_COLORS[drill.category]
          const scores = scoresByExercise[drill.id] || []
          const best = bestScoreFor(scores)
          const lastDifficulty = scores[0]?.difficulty || null

          return (
            <Card
              key={drill.id}
              p="md"
              className="trainer-select-card trainer-drill-card"
              onClick={() => setSelection({ exercise: drill.id, difficulty: lastDifficulty || 'medio' })}
              style={{ cursor: 'pointer' }}
            >
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon size={34} radius="md" variant="light" color={color}>
                  <Icon size={18} />
                </ThemeIcon>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={600} size="sm" truncate>{t(`trainer.exercicios.${drill.id}.nome`)}</Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>{t(`trainer.exercicios.${drill.id}.descricao`)}</Text>
                </Box>
              </Group>
              <Group justify="space-between" mt="sm" gap={6} wrap="nowrap">
                <Text size="xs" c="dimmed" truncate>
                  {loading ? '…' : best != null ? t('trainer.card.recorde', { score: best }) : t('trainer.card.sem_tentativas')}
                </Text>
                {lastDifficulty && (
                  <Badge size="xs" variant="light" color={color}>{t(`trainer.dificuldades.${lastDifficulty}`)}</Badge>
                )}
              </Group>
            </Card>
          )
        })}
      </SimpleGrid>
    </Container>
  )
}
