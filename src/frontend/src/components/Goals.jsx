import { useState, useEffect } from 'react'
import { Card, Group, Stack, Text, Checkbox, RingProgress, Badge, Skeleton, Alert } from '@mantine/core'
import { IconTarget, IconTrophy, IconInfoCircle } from '@tabler/icons-react'
import { getGoals, toggleGoal } from '../services/api'
import { toast } from '../services/toast'

// Emoji + label per goal category. 'exercise'/'deathmatch' are kept for
// daily goals generated before the categories reform (they only linger
// until that day rolls over).
const CATEGORY_META = {
  aim:        { emoji: '🎯', label: 'Aim' },
  action:     { emoji: '⚔️', label: 'Ação' },
  movement:   { emoji: '⚡', label: 'Movement' },
  game_sense: { emoji: '🧠', label: 'Game Sense' },
  analysis:   { emoji: '🎥', label: 'Análise' },
  exercise:   { emoji: '🎯', label: 'Exercício' },
  deathmatch: { emoji: '⚔️', label: 'Mata-mata' },
}

function GoalRow({ goal, onToggle, busy }) {
  const meta = CATEGORY_META[goal.category] || { emoji: '✓', label: goal.category }
  return (
    <Group
      wrap="nowrap"
      align="flex-start"
      gap="sm"
      className={`goal-row ${busy ? 'busy' : ''}`}
      onClick={() => !busy && onToggle(goal)}
    >
      <Checkbox checked={goal.completed} readOnly tabIndex={-1} mt={2} style={{ pointerEvents: 'none' }} />
      <Stack gap={2} style={{ flex: 1 }}>
        <Group gap={6} wrap="wrap">
          <Text size="sm" fw={600} td={goal.completed ? 'line-through' : undefined} c={goal.completed ? 'dimmed' : undefined}>
            {meta.emoji} {goal.title}
          </Text>
          {goal.level != null && <Badge size="xs" variant="light" color="gray">Nível {goal.level}</Badge>}
        </Group>
        {goal.description && <Text size="xs" c="dimmed">{goal.description}</Text>}
        {goal.level_note && (
          <Text size="xs" fw={600} c={goal.level_note.startsWith('Meta aumentou') ? 'green' : 'orange'}>
            {goal.level_note}
          </Text>
        )}
      </Stack>
    </Group>
  )
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

    const total          = data.daily.length
    const wasComplete    = data.daily_progress.completed === total && total > 0
    const newList        = data.daily.map((g) => (g.id === goal.id ? { ...g, completed: !g.completed } : g))
    const newCount       = newList.filter((g) => g.completed).length
    const isNowComplete  = newCount === total && total > 0

    setData((prev) => ({
      ...prev,
      daily:          newList,
      daily_progress: { ...prev.daily_progress, completed: newCount },
    }))

    try {
      await toggleGoal(goal.id)
      if (isNowComplete && !wasComplete) {
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
      <Card mb="lg"><Skeleton height={80} /></Card>
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
    <Card mb="lg" className={pulse ? 'goals-card--pulse' : ''} style={dailyDone ? { borderColor: 'var(--mantine-color-green-6)' } : undefined}>
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
  )
}
