import { useState, useEffect, useCallback } from 'react'
import {
  Box, Grid, Card, Group, Stack, Text, Title, Button, NumberInput, Badge,
  CopyButton, Tooltip, ActionIcon, Collapse, Code, Progress as MProgress,
} from '@mantine/core'
import { IconArrowLeft, IconDeviceGamepad2, IconBolt, IconTarget, IconRuler2, IconCopy, IconCheck, IconChevronDown, IconArchive } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { convertSensitivity, getSensitivityHistory } from '../services/api'
import { toast } from '../services/toast'
import { calcLocal } from '../services/sensitivityMath'

const DPI_PRESETS = [400, 800, 1200, 1600, 3200]

function fmt(n, dp = 3) {
  return typeof n === 'number' ? n.toFixed(dp) : '—'
}

function CopyChip({ value }) {
  const { t } = useTranslation()
  return (
    <CopyButton value={String(value)}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? t('conversor.copiado') : t('conversor.copiar')} withArrow>
          <ActionIcon variant="light" color={copied ? 'green' : 'brandCyan'} onClick={copy} size="sm">
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  )
}

function HistoryRow({ row }) {
  const d = new Date(row.created_at)
  const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  return (
    <Group justify="space-between" py={6} className="sens-history-row" wrap="wrap">
      <Text size="xs" c="dimmed">{dateStr}</Text>
      <Text size="xs">
        GTA <Text span fw={700}>{row.gta_sensitivity > 0 ? row.gta_sensitivity : `${row.gta_sensitivity} ↕`}</Text>
        {' / '}{row.dpi} DPI
      </Text>
      <Text size="xs">
        KovaaK <Text span fw={700}>{fmt(row.kovaak_sens)}</Text>
        {' · '}Aim Lab <Text span fw={700}>{fmt(row.aimlab_sens)}</Text>
        {' · '}<Text span c="dimmed">{fmt(row.cm_per_360, 1)} cm</Text>
      </Text>
    </Group>
  )
}

export default function SensConverter({ onBack }) {
  const { t } = useTranslation()
  const [gtaSens, setGtaSens]     = useState(50)
  const [dpi,     setDpi]         = useState(800)
  const [result,  setResult]      = useState(null)
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [histErr, setHistErr]     = useState(false)
  const [showFormula, setShowFormula] = useState(false)

  // Preview result computed locally on every keystroke
  const preview = (() => {
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)
    if (!isNaN(s) && s !== 0 && !isNaN(d) && d > 0) return calcLocal(s, d)
    return null
  })()

  const loadHistory = useCallback(() => {
    getSensitivityHistory()
      .then((res) => setHistory(res.data))
      .catch(() => setHistErr(true))
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleConvert = async (e) => {
    e.preventDefault()
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)

    if (isNaN(s) || s === 0)          { toast.error(t('conversor.erros.sens_invalida')); return }
    if (Math.abs(s) > 100)            { toast.error(t('conversor.erros.sens_fora_faixa')); return }
    if (isNaN(d) || d <= 0)           { toast.error(t('conversor.erros.dpi_invalido')); return }

    // Show instant local result
    const local = calcLocal(s, d)
    setResult(local)

    // Persist to backend (fire-and-forget)
    setLoading(true)
    try {
      await convertSensitivity({ gta_sensitivity: s, dpi: d })
      loadHistory()
    } catch {
      // Conversion result is already shown — backend failure is non-fatal
    } finally {
      setLoading(false)
    }
  }

  const display = result || preview

  return (
    <Box className="sens-view">
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1}>{t('conversor.titulo')}</Title>
          <Text c="dimmed" size="sm">{t('conversor.subtitulo')}</Text>
        </Box>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('conversor.voltar_ao_treino')}
        </Button>
      </Group>

      <Grid>
        {/* ── Input panel ── */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <Card>
              <Group gap={6} mb="md">
                <IconDeviceGamepad2 size={18} color="var(--mantine-color-brandCyan-5)" />
                <Text fw={700} size="sm">{t('conversor.configuracao')}</Text>
              </Group>

              <form onSubmit={handleConvert}>
                <Stack gap="md">
                  <NumberInput
                    label={t('conversor.gta_sens_label')}
                    description={t('conversor.gta_sens_desc')}
                    value={gtaSens}
                    onChange={setGtaSens}
                    min={-100}
                    max={100}
                    step={1}
                    placeholder={t('conversor.gta_sens_placeholder')}
                    autoFocus
                  />
                  <Text size="xs" c="dimmed" mt={-8}>
                    <Trans i18nKey="conversor.config_hint" components={{ code: <Code /> }} />
                  </Text>

                  <NumberInput
                    label={t('conversor.dpi_label')}
                    value={dpi}
                    onChange={setDpi}
                    min={1}
                    step={1}
                    placeholder={t('conversor.dpi_placeholder')}
                  />
                  <Group gap={6}>
                    {DPI_PRESETS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="xs"
                        variant={dpi === p ? 'filled' : 'light'}
                        onClick={() => setDpi(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </Group>

                  <Button type="submit" fullWidth loading={loading} disabled={!preview}>
                    {t('conversor.converter_salvar')}
                  </Button>
                </Stack>
              </form>
            </Card>

            {/* Formula info — collapsible */}
            <Card>
              <Button
                variant="subtle" color="gray" size="xs" p={0}
                rightSection={<IconChevronDown size={14} style={{ transform: showFormula ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                onClick={() => setShowFormula((v) => !v)}
              >
                {t('conversor.como_calculamos')}
              </Button>
              <Collapse in={showFormula}>
                <Stack gap={6} mt="md">
                  <Group justify="space-between"><Text size="xs" c="dimmed">{t('conversor.formula.gta_yaw')}</Text><Code>0.0009 °/count</Code></Group>
                  <Group justify="space-between"><Text size="xs" c="dimmed">{t('conversor.formula.kovaak_yaw')}</Text><Code>0.022 °/count</Code></Group>
                  <Group justify="space-between"><Text size="xs" c="dimmed">{t('conversor.formula.aimlab_yaw')}</Text><Code>0.022 °/count</Code></Group>
                  <Text size="xs" ta="center" mt={4}>{t('conversor.formula.formula_texto')}</Text>
                  <Text size="xs" c="dimmed" ta="center">{t('conversor.formula.validado_por')}</Text>
                </Stack>
              </Collapse>
            </Card>
          </Stack>
        </Grid.Col>

        {/* ── Result panel ── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            {display ? (
              <Card>
                <Group justify="space-between" mb="xs">
                  <Group gap={6}>
                    <IconBolt size={18} color="var(--mantine-color-brandCyan-5)" />
                    <Text fw={700} size="sm">{t('conversor.resultado')}</Text>
                  </Group>
                  {result && <Badge color="green" variant="light">{t('conversor.salvo')}</Badge>}
                </Group>

                {display.inverted && (
                  <Text size="xs" c="orange" mb="sm">
                    {t('conversor.eixo_invertido')}
                  </Text>
                )}

                <Grid>
                  <Grid.Col span={4}>
                    <Card withBorder ta="center" p="sm">
                      <IconRuler2 size={20} color="var(--mantine-color-brandCyan-5)" />
                      <Text size="xs" c="dimmed">{t('conversor.cm_360')}</Text>
                      <Text fw={900} size="lg">{fmt(display.cm_per_360, 1)}</Text>
                      <CopyChip value={fmt(display.cm_per_360, 2)} />
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder ta="center" p="sm">
                      <IconBolt size={20} color="var(--mantine-color-orange-5)" />
                      <Text size="xs" c="dimmed">{t('conversor.kovaak')}</Text>
                      <Text fw={900} size="lg">{fmt(display.kovaak_sensitivity, 3)}</Text>
                      <CopyChip value={fmt(display.kovaak_sensitivity, 3)} />
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder ta="center" p="sm">
                      <IconTarget size={20} color="var(--mantine-color-green-5)" />
                      <Text size="xs" c="dimmed">{t('conversor.aimlab')}</Text>
                      <Text fw={900} size="lg">{fmt(display.aimlab_sensitivity, 3)}</Text>
                      <CopyChip value={fmt(display.aimlab_sensitivity, 3)} />
                    </Card>
                  </Grid.Col>
                </Grid>

                <Box mt="md">
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" c="dimmed">{t('conversor.baixa_sens')}</Text>
                    <Text size="xs" c="dimmed">{t('conversor.alta_sens')}</Text>
                  </Group>
                  <MProgress
                    value={Math.min(100, Math.max(2, (1 - Math.log(display.cm_per_360 / 5) / Math.log(200)) * 100))}
                    radius="xl"
                  />
                  <Text size="xs" ta="center" mt={4} c="dimmed">{fmt(display.cm_per_360, 1)} cm/360°</Text>
                </Box>
              </Card>
            ) : (
              <Card ta="center" py="xl">
                <Text size="xl" mb={6}>🎯</Text>
                <Text size="sm" c="dimmed">{t('conversor.resultado_vazio')}</Text>
              </Card>
            )}

            {/* History */}
            <Card>
              <Group justify="space-between" mb="sm">
                <Group gap={6}>
                  <IconArchive size={18} color="var(--mantine-color-brandCyan-5)" />
                  <Text fw={700} size="sm">{t('conversor.historico')}</Text>
                </Group>
                <Badge variant="default">{t('conversor.conversoes_count', { count: history.length })}</Badge>
              </Group>
              {histErr ? (
                <Text size="sm" c="dimmed">{t('conversor.historico_indisponivel')}</Text>
              ) : history.length === 0 ? (
                <Text size="sm" c="dimmed">{t('conversor.historico_vazio')}</Text>
              ) : (
                <Stack gap={0}>
                  {history.map((row) => <HistoryRow key={row.id} row={row} />)}
                </Stack>
              )}
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Box>
  )
}
