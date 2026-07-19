import { Group, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import BrandIcon from './BrandIcon'

export default function BrandLogo() {
  const { t } = useTranslation()
  return (
    <Group gap="sm">
      <BrandIcon size={44} />
      <Stack gap={0}>
        <Text fw={900} size="sm" className="auth-brand">{t('comum.app_name')}</Text>
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: 2 }}>{t('comum.tagline')}</Text>
      </Stack>
    </Group>
  )
}
