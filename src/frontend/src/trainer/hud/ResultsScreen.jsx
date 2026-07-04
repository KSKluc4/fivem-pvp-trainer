import { Box, Card, Group, Stack, Text, Title, Button, Badge, SimpleGrid } from '@mantine/core'
import { IconArrowLeft, IconRefresh, IconTrophy, IconTarget } from '@tabler/icons-react'

function DeltaBadge({ current, compare }) {
  if (compare == null) return <Badge variant="light" color="gray" size="sm">Primeira tentativa</Badge>
  const diff = Math.round(current - compare)
  if (diff === 0) return <Badge variant="light" color="gray" size="sm">Igual à última</Badge>
  const up = diff > 0
  return (
    <Badge variant="light" color={up ? 'green' : 'red'} size="sm">
      {up ? '+' : ''}{diff} vs última
    </Badge>
  )
}

export default function ResultsScreen({ result, lastAttempt, personalBest, savedRemotely, onRetry, onBack }) {
  const isNewRecord = personalBest == null || result.score > personalBest.score

  return (
    <Box className="trainer-results" p="xl" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Group gap={6} mb="lg">
        <IconTrophy size={22} color="var(--mantine-color-yellow-5)" />
        <Title order={2} size="h3">Resultado — Tracking Suave</Title>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="lg">
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>Score</Text>
          <Text fw={900} size="1.8rem">{result.score}</Text>
          <DeltaBadge current={result.score} compare={lastAttempt?.score} />
        </Card>
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>Tracking</Text>
          <Text fw={900} size="1.8rem">{result.accuracyPct.toFixed(1)}%</Text>
          <Text size="xs" c="dimmed">tempo na mira</Text>
        </Card>
        <Card ta="center">
          <Text size="xs" c="dimmed" mb={4}>Melhor sequência</Text>
          <Text fw={900} size="1.8rem">{(result.bestStreakMs / 1000).toFixed(1)}s</Text>
          <Text size="xs" c="dimmed">contínua na mira</Text>
        </Card>
      </SimpleGrid>

      <Card mb="lg">
        <Group justify="space-between">
          <Group gap={6}>
            <IconTarget size={16} color="var(--mantine-color-brandCyan-5)" />
            <Text size="sm">Recorde pessoal ({result.difficultyLabel})</Text>
          </Group>
          {isNewRecord ? (
            <Badge color="yellow" variant="light">🏆 Novo recorde!</Badge>
          ) : (
            <Text fw={700}>{personalBest.score}</Text>
          )}
        </Group>
      </Card>

      {!savedRemotely && (
        <Text size="xs" c="orange" mb="lg">
          ⚠️ Sincronização indisponível no momento — este resultado foi salvo só neste dispositivo.
        </Text>
      )}

      <Group>
        <Button leftSection={<IconRefresh size={16} />} onClick={onRetry}>Tentar novamente</Button>
        <Button variant="light" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>Voltar</Button>
      </Group>
    </Box>
  )
}
