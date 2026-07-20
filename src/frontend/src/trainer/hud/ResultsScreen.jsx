import { Box, Card, Group, Stack, Text, Title, Button, Badge, SimpleGrid } from '@mantine/core'
import { IconArrowLeft, IconRefresh, IconTrophy, IconTarget, IconCheck } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

function DeltaBadge({ current, compare }) {
  const { t } = useTranslation()
  if (compare == null) return <Badge variant="light" color="gray" size="sm">{t('trainer.resultado.primeira_tentativa')}</Badge>
  const diff = Math.round(current - compare)
  if (diff === 0) return <Badge variant="light" color="gray" size="sm">{t('trainer.resultado.igual_ultima')}</Badge>
  const up = diff > 0
  return (
    <Badge variant="light" color={up ? 'green' : 'red'} size="sm">
      {up ? '+' : ''}{diff} {t('trainer.resultado.vs_ultima')}
    </Badge>
  )
}

export default function ResultsScreen({
  result, exerciseName, lastAttempt, personalBest, savedRemotely,
  roundInfo, isFinalRound, onRetry, onBack, onComplete,
}) {
  const { t } = useTranslation()
  const isNewRecord = personalBest == null || result.score > personalBest.score
  const difficultyLabel = t(`trainer.dificuldades.${result.difficulty}`, result.difficulty)
  // Tracking Suave scores continuous time-on-target (unchanged from Phase 1);
  // the click-based drills (Shot Grid / Quick Flick / Micro Adjust) score
  // hit accuracy + average reaction time instead of a streak.
  const isTimeBased = result.mode === 'continuous'

  return (
    <Box className="trainer-results" p="xl" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Group justify="space-between" mb="lg" wrap="wrap">
        <Group gap={6}>
          <IconTrophy size={22} color="var(--mantine-color-yellow-5)" />
          <Title order={2} size="h3">{t('trainer.resultado.titulo', { exercise: exerciseName })}</Title>
        </Group>
        {roundInfo && (
          <Badge size="lg" variant="light" color="brandCyan">
            {t('trainer.resultado.rodada_progresso', { current: roundInfo.current, total: roundInfo.total })}
          </Badge>
        )}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="lg">
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>{t('trainer.resultado.score')}</Text>
          <Text fw={900} size="1.8rem">{result.score}</Text>
          <DeltaBadge current={result.score} compare={lastAttempt?.score} />
        </Card>
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>{t(isTimeBased ? 'trainer.resultado.tracking' : 'trainer.resultado.precisao')}</Text>
          <Text fw={900} size="1.8rem">{result.accuracyPct.toFixed(1)}%</Text>
          <Text size="xs" c="dimmed">{t(isTimeBased ? 'trainer.resultado.tempo_na_mira' : 'trainer.resultado.taxa_acerto')}</Text>
        </Card>
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>{t(isTimeBased ? 'trainer.resultado.melhor_sequencia' : 'trainer.resultado.tempo_medio')}</Text>
          <Text fw={900} size="1.8rem">
            {isTimeBased ? `${(result.bestStreakMs / 1000).toFixed(1)}s` : `${Math.round(result.avgReactionMs)}ms`}
          </Text>
          <Text size="xs" c="dimmed">{t(isTimeBased ? 'trainer.resultado.continua_na_mira' : 'trainer.resultado.reacao_media')}</Text>
        </Card>
      </SimpleGrid>

      <Card mb="lg">
        <Group justify="space-between">
          <Group gap={6}>
            <IconTarget size={16} color="var(--mantine-color-brandCyan-5)" />
            <Text size="sm">{t('trainer.resultado.recorde_pessoal', { difficulty: difficultyLabel })}</Text>
          </Group>
          {isNewRecord ? (
            <Badge color="yellow" variant="light">{t('trainer.resultado.novo_recorde')}</Badge>
          ) : (
            <Text fw={700}>{personalBest.score}</Text>
          )}
        </Group>
      </Card>

      {!savedRemotely && (
        <Text size="xs" c="orange" mb="lg">
          {t('trainer.resultado.sync_indisponivel')}
        </Text>
      )}

      {isFinalRound ? (
        <Button leftSection={<IconCheck size={16} />} onClick={onComplete}>
          {t('trainer.resultado.concluir_rotina')}
        </Button>
      ) : (
        <Group>
          <Button leftSection={<IconRefresh size={16} />} onClick={onRetry}>
            {roundInfo ? t('trainer.resultado.proxima_rodada') : t('trainer.resultado.tentar_novamente')}
          </Button>
          <Button variant="light" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>{t('trainer.resultado.voltar')}</Button>
        </Group>
      )}
    </Box>
  )
}
