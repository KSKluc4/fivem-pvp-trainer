import { Box, Card, Group, SimpleGrid, Text, ThemeIcon, Title, Badge } from '@mantine/core'
import {
  IconFlame, IconFocus2, IconGrid3x3, IconBolt, IconTargetArrow, IconTrophy,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { PRESETS, estimatedMinutes } from './presets.js'

const PRESET_ICONS = {
  flame:  IconFlame,
  focus:  IconFocus2,
  grid:   IconGrid3x3,
  bolt:   IconBolt,
  target: IconTargetArrow,
  trophy: IconTrophy,
}

// One preset card, shared by the full "Presets" section (TrainingRoutine)
// and the compact shortcut (TrainerView) — `compact` only changes sizing/
// how much copy shows, never the data or the click behavior.
function PresetCard({ preset, compact, onStart }) {
  const { t } = useTranslation()
  const Icon = PRESET_ICONS[preset.icon] || IconFlame

  return (
    <Card
      p={compact ? 'sm' : 'md'}
      className="trainer-select-card"
      onClick={() => onStart(preset.id)}
      style={{ cursor: 'pointer' }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon size={compact ? 30 : 34} radius="md" variant="light" color={preset.accentColor}>
          <Icon size={compact ? 16 : 18} />
        </ThemeIcon>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text fw={600} size="sm" truncate>{t(`rotina.presets.catalogo.${preset.id}.nome`)}</Text>
          {!compact && (
            <Text size="xs" c="dimmed" lineClamp={2}>{t(`rotina.presets.catalogo.${preset.id}.descricao`)}</Text>
          )}
        </Box>
      </Group>
      <Group justify="space-between" mt="sm" gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed">{t('rotina.presets.duracao', { minutes: estimatedMinutes(preset) })}</Text>
        <Badge size="xs" variant="light" color={preset.accentColor}>
          {t('rotina.presets.exercicios', { count: preset.items.length })}
        </Badge>
      </Group>
    </Card>
  )
}

// Full "Presets" section — Rotina do dia. `sessionCompleted` only changes
// the clarifying copy above the cards (today's routine is already done, so
// any preset here is a bonus, not what counts as "the" training for the
// streak) — starting one behaves identically either way (PresetPlayer's
// completion marker is idempotent, see its own comment).
export default function RoutinePresets({ compact = false, sessionCompleted = false, onStartPreset }) {
  const { t } = useTranslation()

  if (compact) {
    return (
      <Card p="md" mb="lg" className="trainer-select-card">
        <Text fw={600} size="sm" mb={2}>{t('rotina.presets.atalho_titulo')}</Text>
        <Text size="xs" c="dimmed" mb="sm">{t('rotina.presets.atalho_subtitulo')}</Text>
        <SimpleGrid cols={{ base: 2, xs: 3, md: 6 }} spacing="xs">
          {PRESETS.map((preset) => (
            <PresetCard key={preset.id} preset={preset} compact onStart={onStartPreset} />
          ))}
        </SimpleGrid>
      </Card>
    )
  }

  return (
    <Card mb="lg">
      <Group justify="space-between" align="flex-start" mb={4} wrap="wrap">
        <Title order={3} size="h4">{t('rotina.presets.titulo')}</Title>
        {sessionCompleted && (
          <Badge variant="light" color="green">{t('rotina.presets.extra_badge')}</Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {t(sessionCompleted ? 'rotina.presets.extra_aviso' : 'rotina.presets.subtitulo')}
      </Text>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm">
        {PRESETS.map((preset) => (
          <PresetCard key={preset.id} preset={preset} onStart={onStartPreset} />
        ))}
      </SimpleGrid>
    </Card>
  )
}

export { PRESET_ICONS }
