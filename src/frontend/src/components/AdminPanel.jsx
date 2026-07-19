import { useState, useEffect } from 'react'
import {
  Box, Group, Stack, Title, Text, Button, Card, Paper, Badge, TextInput,
  Table, SimpleGrid, Skeleton, Alert,
} from '@mantine/core'
import { IconArrowLeft, IconChartBar, IconUsers, IconSearch, IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
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
      .catch((e) => setError(e.response?.data?.error || t('admin.erro_carregar')))
      .finally(() => setLoading(false))
  }, [t])

  const filtered = users
    ? users.filter((u) =>
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const dateLocale = i18n.language === 'pt' ? 'pt-BR' : 'en-US'

  return (
    <Box className="admin-view">
      <Group justify="space-between">
        <Box>
          <Title order={1}>{t('admin.titulo')}</Title>
          <Text c="dimmed" size="sm">{t('admin.subtitulo')}</Text>
        </Box>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>{t('admin.voltar')}</Button>
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
              <Text fw={700} size="sm">{t('admin.visao_geral')}</Text>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md">
              <StatCard label={t('admin.stats.total_usuarios')} value={stats.total_users}             color="brandCyan" />
              <StatCard label={t('admin.stats.ativos_7d')}      value={stats.active_users_7d}         color="green" />
              <StatCard label={t('admin.stats.novos_7d')}       value={stats.new_users_7d}            color="orange" />
              <StatCard label={t('admin.stats.novos_30d')}      value={stats.new_users_30d}           color="brandPurple" />
              <StatCard label={t('admin.stats.sessoes_completadas')} value={stats.total_sessions_completed} color="brandPurple" />
            </SimpleGrid>
          </Card>

          {/* ── Distributions ──
              Note: focus/server labels and distribution keys come from the
              backend (admin analytics, not scoped by this i18n pass) and are
              always in Portuguese regardless of the selected UI language. */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Card>
              <Group justify="space-between" mb="md">
                <Text fw={700} size="sm">{t('admin.foco_treino')}</Text>
                {stats.top_focus_label && (
                  <Badge variant="light" color="brandCyan">{stats.top_focus_label} {stats.top_focus_pct}%</Badge>
                )}
              </Group>
              <DistBar distribution={stats.focus_distribution} />
              {!stats.top_focus_label && <Text size="sm" c="dimmed">{t('admin.nenhum_questionario')}</Text>}
            </Card>

            <Card>
              <Group justify="space-between" mb="md">
                <Text fw={700} size="sm">{t('admin.servidor_preferido')}</Text>
                {stats.top_server_label && (
                  <Badge variant="light" color="brandPurple">{stats.top_server_label} {stats.top_server_pct}%</Badge>
                )}
              </Group>
              <DistBar distribution={stats.server_distribution} />
              {!stats.top_server_label && <Text size="sm" c="dimmed">{t('admin.nenhum_questionario')}</Text>}
            </Card>
          </SimpleGrid>

          {/* ── User list ── */}
          <Card>
            <Group justify="space-between" mb="md">
              <Group gap={6}>
                <IconUsers size={18} color="var(--mantine-color-brandCyan-5)" />
                <Text fw={700} size="sm">{t('admin.usuarios_titulo', { count: users?.length ?? 0 })}</Text>
              </Group>
              <TextInput
                size="xs"
                placeholder={t('admin.buscar_placeholder')}
                leftSection={<IconSearch size={14} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Group>

            {filtered.length === 0 ? (
              <Text size="sm" c="dimmed">{search ? t('admin.nenhum_usuario_encontrado') : t('admin.sem_usuarios')}</Text>
            ) : (
              <Table.ScrollContainer minWidth={640}>
                <Table striped highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>{t('admin.tabela.nome')}</Table.Th>
                      <Table.Th>{t('admin.tabela.username')}</Table.Th>
                      <Table.Th>{t('admin.tabela.cadastro')}</Table.Th>
                      <Table.Th>{t('admin.tabela.ultimo_treino')}</Table.Th>
                      <Table.Th>{t('admin.tabela.sessoes')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtered.map((u, i) => (
                      <Table.Tr key={u.id}>
                        <Table.Td>{i + 1}</Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            <Text size="sm">{u.name}</Text>
                            {u.is_admin && <Badge size="xs" color="brandPurple">{t('admin.tabela.admin_badge')}</Badge>}
                          </Group>
                        </Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">@{u.username}</Text></Table.Td>
                        <Table.Td>{u.created_at ? new Date(u.created_at).toLocaleDateString(dateLocale) : '—'}</Table.Td>
                        <Table.Td>{u.last_session ? new Date(u.last_session + 'T12:00:00').toLocaleDateString(dateLocale) : '—'}</Table.Td>
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
