import { useState, useEffect } from 'react'
import { Card, SimpleGrid, Group, Stack, Text, Checkbox, RingProgress, Badge, Skeleton, Alert } from '@mantine/core'
import { IconTarget, IconCalendarWeek, IconTrophy, IconInfoCircle } from '@tabler/icons-react'
import { getGoals, toggleGoal } from '../services/api'
import { toast } from '../services/toast'

function GoalRow({ goal, onToggle, busy }) {
  return (
    <Group
      wrap="nowrap"
      align="flex-start"
      gap="sm"
      className={`goal-row ${busy ? 'busy' : ''}`}
      onClick={() => !busy && onToggle(goal)}
    >
      <Checkbox checked={goal.completed} readOnly tabIndex={-1} mt={2} style={{ pointerEvents: 'none' }} />
      <Box_ done={goal.completed}>
        <Text size="sm" fw={600} td={goal.completed ? 'line-through' : undefined} c={goal.completed ? 'dimmed' : undefined}>
          {goal.title}
        </Text>
        {goal.description && <Text size="xs" c="dimmed">{goal.description}</Text>}
      </Box_>
    </Group>
  )
}

// Tiny wrapper so we don't need an extra import just for a flex-basis box
function Box_({ children }) {
  return <Stack gap={2} style={{ flex: 1 }}>{children}</Stack>
}

function formatDayMonth(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

export default function Goals() {
  const [data, setData]     = useState(null)
  const [error, setError]   = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [pulse, setPulse]   = useState(false)

  const load = () => {
    getGoals()
      .then((res) => { setData(res.data); setError(false) })
      .catch(() => setError(true))
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (goal) => {
    if (busyId || !data) return
    setBusyId(goal.id)

    const period       = goal.period
    const currentList  = data[period]
    const total        = currentList.length
    const wasComplete  = data[`${period}_progress`].completed === total && total > 0
    const newList      = currentList.map((g) => (g.id === goal.id ? { ...g, completed: !g.completed } : g))
    const newCount     = newList.filter((g) => g.completed).length
    const isNowComplete = newCount === total && total > 0

    setData((prev) => ({
      ...prev,
      [period]: newList,
      [`${period}_progress`]: { ...prev[`${period}_progress`], completed: newCount },
    }))

    try {
      await toggleGoal(goal.id)
      if (period === 'daily' && isNowComplete && !wasComplete) {
        toast.success('🎉 Metas do dia completas! Isso conta como um dia ativo no seu streak.')
        setPulse(true)
        setTimeout(() => setPulse(false), 1200)
      }
    } catch (e) {
      toast.error('Não foi possível atualizar a meta. Tente novamente.')
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (error) {
    return (
      <Alert color="gray" variant="light" icon={<IconInfoCircle size={16} />} mb="lg">
        Metas indisponíveis no momento — o resto do treino segue normal.
      </Alert>
    )
  }

  if (!data) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="lg">
        <Card><Skeleton height={80} /></Card>
        <Card><Skeleton height={80} /></Card>
      </SimpleGrid>
    )
  }

  if (!data.available) {
    return (
      <Alert color="brandCyan" variant="light" icon={<IconInfoCircle size={16} />} mb="lg">
        Sistema de metas chegando em breve por aqui.
      </Alert>
    )
  }

  const dailyDone = data.daily_progress.total > 0 && data.daily_progress.completed === data.daily_progress.total

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="lg">
      <Card className={pulse ? 'goals-card--pulse' : ''} style={dailyDone ? { borderColor: 'var(--mantine-color-green-6)' } : undefined}>
        <Group justify="space-between" mb="sm">
          <Group gap={6}>
            <IconTarget size={18} color="var(--mantine-color-brandCyan-5)" />
            <Text fw={700} size="sm">Metas de hoje</Text>
          </Group>
          <RingProgress
            size={48}
            thickness={5}
            roundCaps
            sections={[{ value: data.daily_progress.total ? (data.daily_progress.completed / data.daily_progress.total) * 100 : 0, color: 'green' }]}
            label={<Text size="xs" fw={800} ta="center">{data.daily_progress.completed}/{data.daily_progress.total}</Text>}
          />
        </Group>
        <Stack gap="xs">
          {data.daily.map((g) => (
            <GoalRow key={g.id} goal={g} onToggle={handleToggle} busy={busyId === g.id} />
          ))}
        </Stack>
        {dailyDone && (
          <Group gap={6} mt="sm" justify="center">
            <IconTrophy size={16} color="var(--mantine-color-yellow-5)" />
            <Text size="sm" fw={700} c="green">Todas as metas de hoje concluídas!</Text>
          </Group>
        )}
      </Card>

      <Card>
        <Group justify="space-between" mb="sm">
          <Group gap={6}>
            <IconCalendarWeek size={18} color="var(--mantine-color-brandPurple-4)" />
            <Text fw={700} size="sm">Metas da semana</Text>
          </Group>
          <RingProgress
            size={48}
            thickness={5}
            roundCaps
            sections={[{ value: data.weekly_progress.total ? (data.weekly_progress.completed / data.weekly_progress.total) * 100 : 0, color: 'brandPurple' }]}
            label={<Text size="xs" fw={800} ta="center">{data.weekly_progress.completed}/{data.weekly_progress.total}</Text>}
          />
        </Group>
        <Stack gap="xs">
          {data.weekly.map((g) => (
            <GoalRow key={g.id} goal={g} onToggle={handleToggle} busy={busyId === g.id} />
          ))}
        </Stack>
        <Group justify="flex-end" mt="sm">
          <Badge variant="light" color="gray" size="sm">Reseta segunda-feira ({formatDayMonth(data.weekly_resets_at)})</Badge>
        </Group>
      </Card>
    </SimpleGrid>
  )
}
