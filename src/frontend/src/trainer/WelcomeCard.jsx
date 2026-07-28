import { useState, useEffect } from 'react'
import { Card, Group, Text, Button, ThemeIcon } from '@mantine/core'
import { IconSparkles, IconFlame, IconTrophy, IconRefresh, IconArrowsShuffle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { getMe } from '../services/api'
import { useAllTrainerScores } from './useAllTrainerScores'
import { resolveWelcomeState } from './welcomeState.js'

// "Retomada inteligente" — a light context banner at the top of Rotina do
// dia, built from resolveWelcomeState (welcomeState.js, pure/tested). Every
// action here triggers a PRESET (onStartPreset), never the questionnaire —
// this card is about getting back into training with the fewest clicks,
// not re-answering anything.
export default function WelcomeCard({ sessionCompleted, onStartPreset }) {
  const { t } = useTranslation()
  const { scoresByExercise, loading } = useAllTrainerScores()
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    getMe().then((res) => setStreak(res.data?.stats?.streak ?? 0)).catch(() => {})
  }, [])

  if (loading) return null

  const state = resolveWelcomeState({ scoresByExercise, sessionCompleted, streak })
  const categoryLabel = (category) => t(`trainer.categorias.${category}`)

  if (state.variant === 'new_user') {
    return (
      <Card mb="lg">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={38} radius="md" variant="light" color="brandCyan">
            <IconSparkles size={20} />
          </ThemeIcon>
          <Text size="sm">{t('rotina.boas_vindas.novo_usuario')}</Text>
        </Group>
      </Card>
    )
  }

  if (state.variant === 'completed') {
    return (
      <Card mb="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={38} radius="md" variant="light" color="yellow">
              <IconTrophy size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm">{t('rotina.boas_vindas.concluido_titulo')}</Text>
              <Text size="xs" c="dimmed">{t('rotina.boas_vindas.concluido_streak', { count: state.streak })}</Text>
            </div>
          </Group>
          <Button size="xs" variant="light" onClick={() => onStartPreset(state.suggestedPresetId)}>
            {t('rotina.boas_vindas.treino_extra_botao')}
          </Button>
        </Group>
      </Card>
    )
  }

  if (state.variant === 'idle') {
    return (
      <Card mb="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={38} radius="md" variant="light" color="brandCyan">
              <IconFlame size={20} />
            </ThemeIcon>
            <Text size="sm">{t('rotina.boas_vindas.retomada')}</Text>
          </Group>
          <Button size="xs" onClick={() => onStartPreset(state.suggestedPresetId)}>
            {t('rotina.boas_vindas.retomada_botao')}
          </Button>
        </Group>
      </Card>
    )
  }

  // 'recent' — daysSince is 0, 1, or 2 (RECENT_WINDOW_DAYS), each with its
  // own phrasing so "yesterday" is never shown for 2-days-ago.
  const focusKey = state.daysSince === 0 ? 'hoje_focou' : state.daysSince === 1 ? 'ontem_focou' : 'recente_focou'
  return (
    <Card mb="lg">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={38} radius="md" variant="light" color="brandCyan">
            <IconSparkles size={20} />
          </ThemeIcon>
          <Text size="sm">{t(`rotina.boas_vindas.${focusKey}`, { categoria: categoryLabel(state.lastCategory) })}</Text>
        </Group>
        <Group gap="xs">
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => onStartPreset(state.repeatPresetId)}>
            {t('rotina.boas_vindas.repetir_foco')}
          </Button>
          <Button size="xs" variant="light" leftSection={<IconArrowsShuffle size={14} />} onClick={() => onStartPreset(state.varyPresetId)}>
            {t('rotina.boas_vindas.variar_para', { categoria: categoryLabel(state.suggestedCategory) })}
          </Button>
        </Group>
      </Group>
    </Card>
  )
}
