import { useState, useEffect, useCallback } from 'react'
import {
  Box, Group, Stack, Title, Text, Button, Card, Badge, Pagination, Modal, Skeleton, Center,
} from '@mantine/core'
import { IconArrowLeft, IconHistory } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { getQuestionnaireHistory, reactivateProfile } from '../services/api'
import { toast } from '../services/toast'

const PAGE_SIZE = 10

// SPEC-006 — lists every past questionnaire_results row (newest first) and
// lets the user "reactivate" one: a NEW snapshot row gets created from the
// chosen profile's answers (the old row is never touched) and today's
// routine is regenerated from it. `onReactivated` gets the same
// {user_id, session_id, name, routine} shape a fresh questionnaire submit
// returns, so App.jsx can reuse handleQuestionnaireComplete for both.
export default function HistoricoPerfis({ onBack, onReactivated }) {
  const { t } = useTranslation()
  const [page, setPage]           = useState(1)
  const [items, setItems]         = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [confirmId, setConfirmId] = useState(null)
  const [reactivating, setReactivating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getQuestionnaireHistory(page, PAGE_SIZE)
      .then((res) => { setItems(res.data.items); setTotal(res.data.total) })
      .catch(() => { setItems([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  const handleReactivate = async () => {
    if (confirmId == null) return
    setReactivating(true)
    try {
      const res = await reactivateProfile(confirmId)
      toast.success(t('historico_perfis.reativar_sucesso'))
      onReactivated(res.data)
    } catch {
      toast.error(t('comum.erros.erro_generico'))
      setReactivating(false)
      setConfirmId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Box className="historico-perfis-view">
      <Group justify="space-between" mb="lg">
        <Group gap={6}>
          <IconHistory size={20} color="var(--mantine-color-brandCyan-5)" />
          <Title order={1} size="h2">{t('historico_perfis.titulo')}</Title>
        </Group>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('comum.voltar')}
        </Button>
      </Group>

      {loading ? (
        <Stack gap="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={130} radius="md" />)}
        </Stack>
      ) : items.length === 0 ? (
        <Text c="dimmed" fs="italic">{t('historico_perfis.vazio')}</Text>
      ) : (
        <Stack gap="md" mb="lg">
          {items.map((item, i) => (
            <ProfileCard
              key={item.id}
              item={item}
              isCurrent={page === 1 && i === 0}
              t={t}
              onReactivate={() => setConfirmId(item.id)}
            />
          ))}
        </Stack>
      )}

      {totalPages > 1 && (
        <Center mb="lg">
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Center>
      )}

      <Modal
        opened={confirmId != null}
        onClose={() => setConfirmId(null)}
        title={t('historico_perfis.reativar_confirmar_titulo')}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t('historico_perfis.reativar_confirmar_corpo')}</Text>
          <Group grow>
            <Button loading={reactivating} onClick={handleReactivate}>
              {t('historico_perfis.reativar')}
            </Button>
            <Button variant="light" color="gray" onClick={() => setConfirmId(null)} disabled={reactivating}>
              {t('comum.cancelar')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}

function ProfileCard({ item, isCurrent, t, onReactivate }) {
  const label = (field, value) => t(`questionario.perguntas.${field}.opcoes.${value}.label`, value)
  const badgeText = (field) => (item[field] || []).map((v) => label(field, v)).join(' + ')
  const preview = item.preview || {}
  const drillName = (id) => t(`trainer.exercicios.${id}.nome`, id)

  return (
    <Card withBorder>
      <Group justify="space-between" mb={6}>
        <Text size="sm" c="dimmed">{formatDate(item.created_at)}</Text>
        {isCurrent && <Badge color="brandCyan" variant="light">{t('historico_perfis.perfil_atual')}</Badge>}
      </Group>

      <Group gap={6} mb={6}>
        {item.focus_area?.length > 0 && <Badge variant="light">{badgeText('focus_area')}</Badge>}
        {item.aim_difficulty?.length > 0 && <Badge variant="light" color="brandPurple">{badgeText('aim_difficulty')}</Badge>}
        {item.specific_weakness?.length > 0 && <Badge variant="light" color="orange">{badgeText('specific_weakness')}</Badge>}
      </Group>

      <Text size="xs" c="dimmed" mb={6}>
        {t(`questionario.perguntas.experience_level.opcoes.${item.experience_level}.label`, item.experience_level)}
        {' · '}
        {t('historico_perfis.minutos_dia', { minutes: item.daily_time })}
      </Text>

      <Text size="xs" c="dimmed" mb="md">
        {t('historico_perfis.preview_texto', {
          warmup:   preview.warmup_drill ? drillName(preview.warmup_drill) : '—',
          principal: preview.main_drills?.length ? preview.main_drills.map(drillName).join(' + ') : '—',
          matches:  preview.match_count ?? 0,
          duration: preview.total_duration ?? 0,
        })}
      </Text>

      {!isCurrent && (
        <Button variant="outline" size="xs" onClick={onReactivate}>
          {t('historico_perfis.reativar')}
        </Button>
      )}
    </Card>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
