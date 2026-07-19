import { Box, Card, Group, Stack, Text, Title, Button, Badge, SimpleGrid } from '@mantine/core'
import { IconArrowLeft, IconRefresh, IconTrophy, IconTarget } from '@tabler/icons-react'
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

export default function ResultsScreen({ result, lastAttempt, personalBest, savedRemotely, onRetry, onBack }) {
  const { t } = useTranslation()
  const isNewRecord = personalBest == null || result.score > personalBest.score
  const difficultyLabel = t(`trainer.dificuldades.${result.difficulty}`, result.difficulty)

  return (
    <Box className="trainer-results" p="xl" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Group gap={6} mb="lg">
        <IconTrophy size={22} color="var(--mantine-color-yellow-5)" />
        <Title order={2} size="h3">{t('trainer.resultado.titulo')}</Title>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="lg">
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>{t('trainer.resultado.score')}</Text>
          <Text fw={900} size="1.8rem">{result.score}</Text>
          <DeltaBadge current={result.score} compare={lastAttempt?.score} />
        </Card>
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>{t('trainer.resultado.tracking')}</Text>
          <Text fw={900} size="1.8rem">{result.accuracyPct.toFixed(1)}%</Text>
          <Text size="xs" c="dimmed">{t('trainer.resultado.tempo_na_mira')}</Text>
        </Card>
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>{t('trainer.resultado.melhor_sequencia')}</Text>
          <Text fw={900} size="1.8rem">{(result.bestStreakMs / 1000).toFixed(1)}s</Text>
          <Text size="xs" c="dimmed">{t('trainer.resultado.continua_na_mira')}</Text>
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

      <Group>
        <Button leftSection={<IconRefresh size={16} />} onClick={onRetry}>{t('trainer.resultado.tentar_novamente')}</Button>
        <Button variant="light" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>{t('trainer.resultado.voltar')}</Button>
      </Group>
    </Box>
  )
}
