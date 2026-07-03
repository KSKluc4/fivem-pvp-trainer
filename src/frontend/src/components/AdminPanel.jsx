import { useState, useEffect } from 'react'
import {
  Box, Group, Stack, Title, Text, Button, Card, Paper, Badge, TextInput,
  Table, SimpleGrid, Skeleton, Alert,
} from '@mantine/core'
import { IconArrowLeft, IconChartBar, IconUsers, IconSearch, IconAlertCircle } from '@tabler/icons-react'
import { getAdminStats, getAdminUsers } from '../services/api'

function StatCard({ label, value, sub, color }) {
  return (
    <Paper p="md" ta="center">
      <Text fw={900} size="1.6rem" c={color}>{value ?? '—'}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
      {sub && <Text size="10px" c="dimmed">{sub}</Text>}
    </Paper>
  )
}

function DistBar({ distribution }) {
  if (!distribution || Object.keys(distribution).length === 0) return null
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  return (
    <Stack gap={6}>
      {entries.map(([key, pct]) => (
        <Group key={key} wrap="nowrap" gap="sm">
          <Text size="xs" w={90} truncate>{key}</Text>
          <div style={{ flex: 1, height: 8, background: 'var(--mantine-color-dark-6)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--mantine-color-brandCyan-5)' }} />
          </div>
          <Text size="xs" w={36} ta="right">{pct}%</Text>
        </Group>
      ))}
    </Stack>
  )
}

export default function AdminPanel({ onBack }) {
  const [stats,   setStats]   = useState(null)
  const [users,   setUsers]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    Promise.all([getAdminStats(), getAdminUsers()])
      .then(([sRes, uRes]) => {
        setStats(sRes.data)
        setUsers(uRes.data)
      })
      .catch((e) => setError(e.response?.data?.error || 'Erro ao carregar painel'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users
    ? users.filter((u) =>
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
      )
    : []

  return (
    <Box className="admin-view">
      <Group justify="space-between">
        <Box>
          <Title order={1}>⚙️ Painel de Admin</Title>
          <Text c="dimmed" size="sm">Visão geral da plataforma</Text>
        </Box>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>Voltar</Button>
      </Group>

      {loading && (
        <Stack gap="md">
          <Skeleton height={30} width="40%" />
          <SimpleGrid cols={4} spacing="md">
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={90} />)}
          </SimpleGrid>
        </Stack>
      )}

      {error && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>{error}</Alert>
      )}

      {stats && !loading && (
        <>
          {/* ── Main stats ── */}
          <Card>
            <Group gap={6} mb="md">
              <IconChartBar size={18} color="var(--mantine-color-brandCyan-5)" />
              <Text fw={700} size="sm">Visão Geral</Text>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md">
              <StatCard label="Total de usuários" value={stats.total_users}             color="brandCyan" />
              <StatCard label="Ativos (7 dias)"    value={stats.active_users_7d}         color="green" />
              <StatCard label="Novos (7 dias)"     value={stats.new_users_7d}            color="orange" />
              <StatCard label="Novos (30 dias)"    value={stats.new_users_30d}           color="brandPurple" />
              <StatCard label="Sessões completadas" value={stats.total_sessions_completed} color="brandPurple" />
            </SimpleGrid>
          </Card>

          {/* ── Distributions ── */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Card>
              <Group justify="space-between" mb="md">
                <Text fw={700} size="sm">🎯 Foco de Treino</Text>
                {stats.top_focus_label && (
                  <Badge variant="light" color="brandCyan">{stats.top_focus_label} {stats.top_focus_pct}%</Badge>
                )}
              </Group>
              <DistBar distribution={stats.focus_distribution} />
              {!stats.top_focus_label && <Text size="sm" c="dimmed">Nenhum questionário respondido ainda</Text>}
            </Card>

            <Card>
              <Group justify="space-between" mb="md">
                <Text fw={700} size="sm">🎮 Servidor Preferido</Text>
                {stats.top_server_label && (
                  <Badge variant="light" color="brandPurple">{stats.top_server_label} {stats.top_server_pct}%</Badge>
                )}
              </Group>
              <DistBar distribution={stats.server_distribution} />
              {!stats.top_server_label && <Text size="sm" c="dimmed">Nenhum questionário respondido ainda</Text>}
            </Card>
          </SimpleGrid>

          {/* ── User list ── */}
          <Card>
            <Group justify="space-between" mb="md">
              <Group gap={6}>
                <IconUsers size={18} color="var(--mantine-color-brandCyan-5)" />
                <Text fw={700} size="sm">Usuários ({users?.length ?? 0})</Text>
              </Group>
              <TextInput
                size="xs"
                placeholder="Buscar nome ou username…"
                leftSection={<IconSearch size={14} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Group>

            {filtered.length === 0 ? (
              <Text size="sm" c="dimmed">{search ? 'Nenhum usuário encontrado.' : 'Sem usuários.'}</Text>
            ) : (
              <Table.ScrollContainer minWidth={640}>
                <Table striped highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Nome</Table.Th>
                      <Table.Th>Username</Table.Th>
                      <Table.Th>Cadastro</Table.Th>
                      <Table.Th>Último treino</Table.Th>
                      <Table.Th>Sessões</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtered.map((u, i) => (
                      <Table.Tr key={u.id}>
                        <Table.Td>{i + 1}</Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            <Text size="sm">{u.name}</Text>
                            {u.is_admin && <Badge size="xs" color="brandPurple">admin</Badge>}
                          </Group>
                        </Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">@{u.username}</Text></Table.Td>
                        <Table.Td>{u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                        <Table.Td>{u.last_session ? new Date(u.last_session + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</Table.Td>
                        <Table.Td>{u.total_sessions}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </>
      )}
    </Box>
  )
}
