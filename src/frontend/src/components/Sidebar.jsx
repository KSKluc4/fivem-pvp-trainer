import { Tooltip, UnstyledButton, Group, Text, Stack, Divider } from '@mantine/core'
import {
  IconLayoutDashboard, IconClipboardList, IconTargetArrow, IconDeviceGamepad2,
  IconShieldLock, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand,
  IconUserCircle,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import BrandIcon from './BrandIcon'
import LanguageSwitcher from './LanguageSwitcher'
import UserMenu from './UserMenu'

const NAV_ITEMS = [
  { view: 'progress',  labelKey: 'sidebar.dashboard', icon: IconLayoutDashboard },
  { view: 'routine',   labelKey: 'sidebar.rotina',    icon: IconClipboardList },
  { view: 'trainer',   labelKey: 'sidebar.treinar',   icon: IconTargetArrow },
  { view: 'converter', labelKey: 'sidebar.conversor', icon: IconDeviceGamepad2 },
  { view: 'profile',   labelKey: 'sidebar.perfil',    icon: IconUserCircle },
]

const ADMIN_ITEM = { view: 'admin', labelKey: 'sidebar.admin', icon: IconShieldLock }

// Fixed left navigation, replacing the old top-bar navigation. Persistently
// visible on every authenticated screen (see App.jsx) — collapses to an
// icon-only rail (width driven by the parent AppShell's navbar.width) with
// its own expand state persisted to localStorage so it survives relaunches.
export default function Sidebar({
  user, activeView, collapsed, onToggleCollapse, onNavigate,
  onLogout, onUserUpdate, onChangeProfile,
}) {
  const { t } = useTranslation()
  const items = user?.is_admin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        <BrandIcon size={22} />
        {!collapsed && <Text fw={800} size="sm" truncate>{t('comum.app_name')}</Text>}
      </div>

      <Stack gap={2} className="sidebar-nav">
        {items.map(({ view, labelKey, icon: Icon }) => {
          const label = t(labelKey)
          const active = activeView === view
          const btn = (
            <UnstyledButton
              key={view}
              className={`sidebar-nav-item${active ? ' active' : ''}`}
              onClick={() => onNavigate(view)}
            >
              <Group gap="sm" wrap="nowrap">
                <Icon size={18} stroke={1.75} />
                {!collapsed && <Text size="sm" fw={active ? 700 : 500} truncate>{label}</Text>}
              </Group>
            </UnstyledButton>
          )
          return collapsed ? (
            <Tooltip key={view} label={label} position="right" withArrow openDelay={200}>
              {btn}
            </Tooltip>
          ) : btn
        })}
      </Stack>

      <div className="sidebar-footer">
        <Tooltip label={t(collapsed ? 'sidebar.expandir' : 'sidebar.recolher')} position="right" withArrow openDelay={200}>
          <UnstyledButton className="sidebar-collapse-btn" onClick={onToggleCollapse}>
            {collapsed ? <IconLayoutSidebarLeftExpand size={18} stroke={1.75} /> : <IconLayoutSidebarLeftCollapse size={18} stroke={1.75} />}
            {!collapsed && <Text size="sm">{t('sidebar.recolher')}</Text>}
          </UnstyledButton>
        </Tooltip>

        <Divider my={4} />

        <div className={`sidebar-footer-row${collapsed ? ' collapsed' : ''}`}>
          {user && (
            <UserMenu
              user={user}
              collapsed={collapsed}
              onLogout={onLogout}
              onUserUpdate={onUserUpdate}
              onChangeProfile={onChangeProfile}
              onConverter={() => onNavigate('converter')}
              onTrainer={() => onNavigate('trainer')}
              onAdmin={() => onNavigate('admin')}
              onProfile={() => onNavigate('profile')}
            />
          )}
          <LanguageSwitcher position="top-start" compact={collapsed} />
        </div>
      </div>
    </div>
  )
}
