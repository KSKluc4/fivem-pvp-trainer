import { useState, useEffect, useRef } from 'react'
import { Box, Stack, Group, Text, Title, NumberInput, Slider, Button, Card, Badge } from '@mantine/core'
import { IconTarget, IconDeviceGamepad2 } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { getSensitivityHistory } from '../../services/api'
import { calcLocal } from '../../services/sensitivityMath'
import { loadTrainerSensSettings, saveTrainerSensSettings, effectiveDegPerCount } from './trainerSensitivity'

// Live preview needs *some* rotation speed even before the real value loads.
const FALLBACK_DEG_PER_COUNT = 0.03

export default function SensitivitySetup({ onDone }) {
  const { t } = useTranslation()
  const [gtaSens, setGtaSens] = useState(50)
  const [dpi, setDpi]         = useState(800)
  const [fineTune, setFineTune] = useState(1.0)
  const [loadedFromHistory, setLoadedFromHistory] = useState(false)
  const previewRef  = useRef(null)
  const previewAngle = useRef(0)

  useEffect(() => {
    const existing = loadTrainerSensSettings()
    if (existing.gtaSens != null) {
      setGtaSens(existing.gtaSens)
      setDpi(existing.dpi)
      setFineTune(existing.fineTuneMultiplier)
      return
    }
    // First run — try to prefill from the sensitivity converter's history
    getSensitivityHistory()
      .then((res) => {
        const last = res.data?.[0]
        if (last) {
          setGtaSens(last.gta_sensitivity)
          setDpi(last.dpi)
          setLoadedFromHistory(true)
        }
      })
      .catch(() => {})
  }, [])

  const preview = (() => {
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)
    if (isNaN(s) || s === 0 || isNaN(d) || d <= 0) return null
    return calcLocal(s, d)
  })()

  const degPerCount = (() => {
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    if (isNaN(s) || s === 0) return FALLBACK_DEG_PER_COUNT
    return effectiveDegPerCount({ gtaSens: s, fineTuneMultiplier: fineTune })
  })()

  // Live preview: while hovering the box, raw mouse movement rotates the
  // indicator by the exact same deg/count the 3D camera would use — lets
  // the player feel the fine-tune adjustment before ever entering the arena.
  const handlePreviewMouseMove = (e) => {
    previewAngle.current += e.movementX * degPerCount
    if (previewRef.current) previewRef.current.style.transform = `rotate(${previewAngle.current}deg)`
  }

  const handleSave = () => {
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)
    saveTrainerSensSettings({ gtaSens: s, dpi: d, fineTuneMultiplier: fineTune })
    onDone()
  }

  const canSave = preview != null

  return (
    <Box className="trainer-sens-setup">
      <Group gap={6} mb="md">
        <IconDeviceGamepad2 size={20} color="var(--mantine-color-brandCyan-5)" />
        <Title order={2} size="h3">{t('trainer.sensitivity_setup.titulo')}</Title>
      </Group>
      <Text size="sm" c="dimmed" mb="lg">
        {t('trainer.sensitivity_setup.descricao')}
        {loadedFromHistory && ' ' + t('trainer.sensitivity_setup.carregado_historico')}
      </Text>

      <Group align="flex-start" gap="lg" wrap="wrap">
        <Card style={{ flex: 1, minWidth: 260 }}>
          <Stack gap="md">
            <NumberInput
              label={t('trainer.sensitivity_setup.gta_sens_label')}
              description={t('trainer.sensitivity_setup.gta_sens_desc')}
              value={gtaSens}
              onChange={setGtaSens}
              min={-100}
              max={100}
              step={1}
            />
            <NumberInput
              label={t('trainer.sensitivity_setup.dpi_label')}
              value={dpi}
              onChange={setDpi}
              min={1}
              step={1}
            />

            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="sm">{t('trainer.sensitivity_setup.ajuste_fino')}</Text>
                <Badge variant="light" color="brandCyan">{fineTune.toFixed(2)}×</Badge>
              </Group>
              <Slider
                min={0.5}
                max={1.5}
                step={0.01}
                value={fineTune}
                onChange={setFineTune}
                label={(v) => `${v.toFixed(2)}×`}
                marks={[{ value: 1.0, label: '1.00×' }]}
              />
              <Text size="xs" c="dimmed" mt={4}>
                {t('trainer.sensitivity_setup.ajuste_fino_desc')}
              </Text>
            </Box>

            <Button onClick={handleSave} disabled={!canSave} leftSection={<IconTarget size={16} />}>
              {t('trainer.sensitivity_setup.salvar_continuar')}
            </Button>
          </Stack>
        </Card>

        <Card style={{ flex: '0 0 220px' }} ta="center">
          <Text size="xs" c="dimmed" mb="sm">{t('trainer.sensitivity_setup.preview_label')}</Text>
          <Box
            onMouseMove={handlePreviewMouseMove}
            style={{
              width: 160, height: 160, margin: '0 auto', borderRadius: '50%',
              background: 'var(--mantine-color-dark-8)',
              border: '1px solid var(--mantine-color-dark-5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'crosshair', position: 'relative', overflow: 'hidden',
            }}
          >
            <div
              ref={previewRef}
              style={{
                width: 4, height: 70, background: 'var(--mantine-color-brandCyan-5)',
                position: 'absolute', top: '50%', left: '50%',
                transformOrigin: 'top center', marginLeft: -2,
              }}
            />
          </Box>
          {preview && (
            <Text size="xs" c="dimmed" mt="sm">{preview.cm_per_360.toFixed(1)} cm/360°</Text>
          )}
        </Card>
      </Group>
    </Box>
  )
}
