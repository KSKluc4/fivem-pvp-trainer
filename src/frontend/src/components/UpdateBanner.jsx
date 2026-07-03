import { useState, useEffect } from 'react'
import { Alert, Group, Text, Button } from '@mantine/core'
import { IconRocket } from '@tabler/icons-react'

export default function UpdateBanner() {
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
          Versão <Text span fw={700}>{updateInfo.version}</Text> disponível — baixada e pronta para instalar
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            loading={restarting}
            onClick={() => { setRestarting(true); window.electronAPI.restartNow() }}
          >
            Reiniciar agora
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setDismissed(true)} title="Será instalado ao fechar o app">
            Depois
          </Button>
        </Group>
      </Group>
    </Alert>
  )
}
