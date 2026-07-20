import { useState, useEffect } from 'react'
import {
  Box, Grid, Card, Group, Stack, Text, Title, Button, NumberInput, Badge,
  CopyButton, Tooltip, ActionIcon, Collapse, Code, Progress as MProgress,
} from '@mantine/core'
import { IconArrowLeft, IconTarget, IconRuler2, IconCopy, IconCheck, IconChevronDown } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { calcLocal } from '../services/sensitivityMath'
import { loadTrainerSensSettings, saveTrainerSensSettings } from '../trainer/sensitivity/trainerSensitivity'
import { toast } from '../services/toast'

const DPI_PRESETS = [400, 800, 1200, 1600, 3200]

function fmt(n, dp = 3) {
  return typeof n === 'number' ? n.toFixed(dp) : '—'
}

function CopyChip({ value }) {
  const { t } = useTranslation()
  return (
    <CopyButton value={String(value)}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? t('sensibilidade.copiado') : t('sensibilidade.copiar')} withArrow>
          <ActionIcon variant="light" color={copied ? 'green' : 'brandCyan'} onClick={copy} size="sm">
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  )
}

// "Minha Sensibilidade" — the single place GTA V sens + DPI are configured.
// This is the SAME value the in-app trainer uses (see
// trainer/sensitivity/trainerSensitivity.js) — saving here updates it
// everywhere, no separate KovaaK's/Aim Lab conversion anymore.
export default function Sensitivity({ onBack }) {
  const { t } = useTranslation()
  const [gtaSens, setGtaSens] = useState(50)
  const [dpi,     setDpi]     = useState(800)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [showFormula, setShowFormula] = useState(false)

  useEffect(() => {
    const existing = loadTrainerSensSettings()
    if (existing.gtaSens != null) {
      setGtaSens(existing.gtaSens)
      setDpi(existing.dpi)
    }
  }, [])

  const preview = (() => {
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)
    if (!isNaN(s) && s !== 0 && !isNaN(d) && d > 0) return calcLocal(s, d)
    return null
  })()

  const handleSave = async (e) => {
    e.preventDefault()
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)

    if (isNaN(s) || s === 0) { toast.error(t('sensibilidade.erros.sens_invalida')); return }
    if (Math.abs(s) > 100)   { toast.error(t('sensibilidade.erros.sens_fora_faixa')); return }
    if (isNaN(d) || d <= 0)  { toast.error(t('sensibilidade.erros.dpi_invalido')); return }

    setSaving(true)
    setSaved(false)
    try {
      saveTrainerSensSettings({ gtaSens: s, dpi: d })
      setSaved(true)
      toast.success(t('sensibilidade.salvo_sucesso'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box className="sens-view">
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1}>{t('sensibilidade.titulo')}</Title>
          <Text c="dimmed" size="sm">{t('sensibilidade.subtitulo')}</Text>
        </Box>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('sensibilidade.voltar_ao_treino')}
        </Button>
      </Group>

      <Grid>
        {/* ── Input panel ── */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <Card>
              <Group gap={6} mb="md">
                <IconTarget size={18} color="var(--mantine-color-brandCyan-5)" />
                <Text fw={700} size="sm">{t('sensibilidade.configuracao')}</Text>
              </Group>

              <form onSubmit={handleSave}>
                <Stack gap="md">
                  <NumberInput
                    label={t('sensibilidade.gta_sens_label')}
                    description={t('sensibilidade.gta_sens_desc')}
                    value={gtaSens}
                    onChange={(v) => { setGtaSens(v); setSaved(false) }}
                    min={-100}
                    max={100}
                    step={1}
                    placeholder={t('sensibilidade.gta_sens_placeholder')}
                    autoFocus
                  />
                  <Text size="xs" c="dimmed" mt={-8}>
                    <Trans i18nKey="sensibilidade.config_hint" components={{ code: <Code /> }} />
                  </Text>

                  <NumberInput
                    label={t('sensibilidade.dpi_label')}
                    value={dpi}
                    onChange={(v) => { setDpi(v); setSaved(false) }}
                    min={1}
                    step={1}
                    placeholder={t('sensibilidade.dpi_placeholder')}
                  />
                  <Group gap={6}>
                    {DPI_PRESETS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="xs"
                        variant={dpi === p ? 'filled' : 'light'}
                        onClick={() => { setDpi(p); setSaved(false) }}
                      >
                        {p}
                      </Button>
                    ))}
                  </Group>

                  <Button type="submit" fullWidth loading={saving} disabled={!preview}>
                    {t('sensibilidade.salvar')}
                  </Button>
                  <Text size="xs" c="dimmed" ta="center">{t('sensibilidade.usado_pelo_treinador')}</Text>
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
                {t('sensibilidade.como_calculamos')}
              </Button>
              <Collapse in={showFormula}>
                <Stack gap={6} mt="md">
                  <Group justify="space-between"><Text size="xs" c="dimmed">{t('sensibilidade.formula.gta_yaw')}</Text><Code>0.0009 °/count</Code></Group>
                  <Text size="xs" ta="center" mt={4}>{t('sensibilidade.formula.formula_texto')}</Text>
                  <Text size="xs" c="dimmed" ta="center">{t('sensibilidade.formula.validado_por')}</Text>
                </Stack>
              </Collapse>
            </Card>
          </Stack>
        </Grid.Col>

        {/* ── Result panel ── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          {preview ? (
            <Card>
              <Group justify="space-between" mb="xs">
                <Group gap={6}>
                  <IconTarget size={18} color="var(--mantine-color-brandCyan-5)" />
                  <Text fw={700} size="sm">{t('sensibilidade.resultado')}</Text>
                </Group>
                {saved && <Badge color="green" variant="light">{t('sensibilidade.salvo')}</Badge>}
              </Group>

              {preview.inverted && (
                <Text size="xs" c="orange" mb="sm">
                  {t('sensibilidade.eixo_invertido')}
                </Text>
              )}

              <Card withBorder ta="center" p="lg">
                <IconRuler2 size={28} color="var(--mantine-color-brandCyan-5)" />
                <Text size="sm" c="dimmed">{t('sensibilidade.cm_360')}</Text>
                <Group justify="center" gap={6}>
                  <Text fw={900} size="2rem">{fmt(preview.cm_per_360, 1)}</Text>
                  <CopyChip value={fmt(preview.cm_per_360, 2)} />
                </Group>
              </Card>

              <Box mt="md">
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">{t('sensibilidade.baixa_sens')}</Text>
                  <Text size="xs" c="dimmed">{t('sensibilidade.alta_sens')}</Text>
                </Group>
                <MProgress
                  value={Math.min(100, Math.max(2, (1 - Math.log(preview.cm_per_360 / 5) / Math.log(200)) * 100))}
                  radius="xl"
                />
                <Text size="xs" ta="center" mt={4} c="dimmed">{fmt(preview.cm_per_360, 1)} cm/360°</Text>
              </Box>
            </Card>
          ) : (
            <Card ta="center" py="xl">
              <Text size="xl" mb={6}>🎯</Text>
              <Text size="sm" c="dimmed">{t('sensibilidade.resultado_vazio')}</Text>
            </Card>
          )}
        </Grid.Col>
      </Grid>
    </Box>
  )
}
