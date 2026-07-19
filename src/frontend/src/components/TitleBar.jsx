import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

// Custom drag region replacing the native Windows title bar (hidden via
// titleBarStyle: 'hidden' in electron/main.js). Double-click-to-maximize and
// window dragging come for free from -webkit-app-region: drag — no JS needed.
//
// `bare`: used directly above the AppShell header, where the brand + user
// menu row right below it already carries the app identity — this strip is
// just empty drag space (same background, no border) so the two rows read
// as one continuous bar instead of a duplicated title. The language switcher
// still needs to render here (not just in the bare row below) so it's
// reachable on every screen, including pre-login ones with no AppShell.
export default function TitleBar({ bare = false }) {
  const { t } = useTranslation()
  return (
    <div className={`titlebar ${bare ? '' : 'titlebar--standalone'}`}>
      {!bare && <Text size="xs" c="dimmed">{t('comum.app_name')}</Text>}
      <div className="titlebar-clickable" style={{ marginLeft: 'auto' }}>
        <LanguageSwitcher />
      </div>
    </div>
  )
}
