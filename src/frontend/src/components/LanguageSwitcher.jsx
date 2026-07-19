import { useTranslation } from 'react-i18next'
import { Menu, ActionIcon } from '@mantine/core'
import { IconWorld } from '@tabler/icons-react'
import { setLanguage } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <Menu position="bottom-end" shadow="md" width={160}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" title="Language / Idioma">
          <IconWorld size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          fw={i18n.language === 'pt' ? 700 : 400}
          onClick={() => setLanguage('pt')}
        >
          Português
        </Menu.Item>
        <Menu.Item
          fw={i18n.language === 'en' ? 700 : 400}
          onClick={() => setLanguage('en')}
        >
          English
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
