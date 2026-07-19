import { useState, useEffect } from 'react'
import { Alert, Group, Text, Button } from '@mantine/core'
import { IconRocket } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'

export default function UpdateBanner() {
  const { t } = useTranslation()
  const [updateInfo, setUpdateInfo] = useState(null)
  const [restarting, setRestarting] = useState(false)
  const [dismissed,  setDismissed]  = useState(false)

  useEffect(() => {
    if (!window.electronAPI?.onUpdateReady) return
    window.electronAPI.onUpdateReady((info) => {
      setUpdateInfo(info)
      setDismissed(false)
    })
  }, [])

  if (!updateInfo || dismissed) return null

  return (
    <Alert
      color="brandCyan"
      variant="light"
      icon={<IconRocket size={18} />}
      mb="md"
      onClose={() => setDismissed(true)}
      withCloseButton={false}
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm">
          <Trans
            i18nKey="comum.update_banner.versao_disponivel"
            values={{ version: updateInfo.version }}
            components={{ bold: <Text span fw={700} /> }}
          />
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            loading={restarting}
            onClick={() => { setRestarting(true); window.electronAPI.restartNow() }}
          >
            {t('comum.update_banner.reiniciar_agora')}
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setDismissed(true)} title={t('comum.update_banner.sera_instalado_tooltip')}>
            {t('comum.update_banner.depois')}
          </Button>
        </Group>
      </Group>
    </Alert>
  )
}
