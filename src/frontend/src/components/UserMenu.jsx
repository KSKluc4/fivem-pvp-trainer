import { useState, useEffect } from 'react'
import {
  Popover, Avatar, Stack, Group, Text, TextInput, Button, UnstyledButton,
  Divider, Alert,
} from '@mantine/core'
import {
  IconPencil, IconSettings, IconDeviceGamepad2, IconShieldLock, IconLogout,
  IconAlertCircle, IconTargetArrow,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { getMe, updateProfile } from '../services/api'
import { toast } from '../services/toast'

const LEVELS = [
  { min: 50, key: 'elite',        icon: '🏆', color: '#ffa502' },
  { min: 30, key: 'veterano',     icon: '🏅', color: '#7b2fd4' },
  { min: 15, key: 'especialista', icon: '🔥', color: '#ff4757' },
  { min: 5,  key: 'atirador',     icon: '⚔️', color: '#00d4ff' },
  { min: 1,  key: 'recruta',      icon: '🎯', color: '#2ed573' },
  { min: 0,  key: 'novato',       icon: '🌱', color: '#7a839a' },
]

function getLevel(n) { return LEVELS.find((l) => n >= l.min) || LEVELS[LEVELS.length - 1] }

function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarHue(username) {
  let h = 0
  for (const c of (username || '')) h = (h * 31 + c.charCodeAt(0)) & 0xfffff
  const hues = [195, 270, 350, 145, 35]
  return hues[h % hues.length]
}

export default function UserMenu({ user, onLogout, onUserUpdate, onChangeProfile, onConverter, onTrainer, onAdmin }) {
  const { t } = useTranslation()
  const [open,    setOpen]    = useState(false)
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', username: '' })
  const [editErr,  setEditErr]  = useState(null)
  const [saving,   setSaving]   = useState(false)

  // Fetch full profile when dropdown opens
  useEffect(() => {
    if (!open) return
    getMe().then((res) => setProfile(res.data)).catch(console.error)
  }, [open])

  const hue   = avatarHue(user.username)
  const inits = initials(user.name)
  const level = getLevel(profile?.stats?.sessions_completed ?? 0)

  const startEdit = () => {
    setEditForm({ name: user.name, username: user.username })
    setEditErr(null)
    setEditing(true)
  }

  const handleSave = async () => {
    setEditErr(null)
    setSaving(true)
    try {
      const res = await updateProfile(editForm)
      onUserUpdate(res.data)
      setEditing(false)
      setOpen(false)
      setProfile(null) // force reload on next open
      toast.success(t('comum.user_menu.perfil_atualizado'))
    } catch (err) {
      const msg = err.response?.data?.error || t('comum.user_menu.erro_ao_salvar')
      setEditErr(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => onLogout()

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom-end"
      shadow="md"
      width={300}
      closeOnClickOutside={!editing}
    >
      <Popover.Target>
        <Avatar
          radius="xl"
          color="initials"
          style={{ background: `hsl(${hue}, 70%, 40%)`, cursor: 'pointer' }}
          onClick={() => setOpen((p) => !p)}
        >
          {inits}
        </Avatar>
      </Popover.Target>

      <Popover.Dropdown>
        <Group wrap="nowrap" mb="sm">
          <Avatar radius="xl" size="lg" style={{ background: `hsl(${hue}, 70%, 35%)` }}>{inits}</Avatar>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fw={700} size="sm" truncate>{user.name}</Text>
            <Text size="xs" c="dimmed" truncate>@{user.username}</Text>
            <Text size="xs" fw={700} style={{ color: level.color }}>{level.icon} {t(`comum.user_menu.niveis.${level.key}`)}</Text>
          </Stack>
        </Group>

        {profile && (
          <Group justify="space-around" mb="sm" py="xs" style={{ borderTop: '1px solid var(--mantine-color-dark-5)', borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
            <Stack gap={0} align="center">
              <Text fw={800} size="sm">{profile.stats.days_trained}</Text>
              <Text size="10px" c="dimmed">{t('comum.user_menu.dias')}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text fw={800} size="sm">{profile.stats.streak}</Text>
              <Text size="10px" c="dimmed">{t('comum.user_menu.streak')}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text fw={800} size="sm">{profile.stats.exercises_done}</Text>
              <Text size="10px" c="dimmed">{t('comum.user_menu.exercicios')}</Text>
            </Stack>
          </Group>
        )}

        {editing ? (
          <Stack gap="sm">
            <TextInput
              size="xs"
              label={t('comum.user_menu.nome_label')}
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('comum.user_menu.nome_placeholder')}
            />
            <TextInput
              size="xs"
              label={t('comum.user_menu.username_label')}
              value={editForm.username}
              onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
              placeholder={t('comum.user_menu.username_placeholder')}
            />
            {editErr && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={14} />} p="xs">
                {editErr}
              </Alert>
            )}
            <Group grow>
              <Button size="xs" onClick={handleSave} loading={saving}>{t('comum.salvar')}</Button>
              <Button size="xs" variant="light" color="gray" onClick={() => setEditing(false)}>{t('comum.cancelar')}</Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap={2}>
            <UnstyledButton className="ud-action-btn" onClick={startEdit}>
              <Group gap="xs"><IconPencil size={15} /><Text size="sm">{t('comum.user_menu.editar_perfil')}</Text></Group>
            </UnstyledButton>
            <UnstyledButton className="ud-action-btn" onClick={() => { setOpen(false); onChangeProfile?.() }}>
              <Group gap="xs"><IconSettings size={15} /><Text size="sm">{t('comum.user_menu.alterar_perfil_treino')}</Text></Group>
            </UnstyledButton>
            <UnstyledButton className="ud-action-btn" onClick={() => { setOpen(false); onTrainer?.() }}>
              <Group gap="xs"><IconTargetArrow size={15} /><Text size="sm">{t('comum.user_menu.treinar_agora')}</Text></Group>
            </UnstyledButton>
            <UnstyledButton className="ud-action-btn" onClick={() => { setOpen(false); onConverter?.() }}>
              <Group gap="xs"><IconDeviceGamepad2 size={15} /><Text size="sm">{t('comum.user_menu.conversor_sensibilidade')}</Text></Group>
            </UnstyledButton>
            {user.is_admin && (
              <UnstyledButton className="ud-action-btn" onClick={() => { setOpen(false); onAdmin?.() }}>
                <Group gap="xs"><IconShieldLock size={15} /><Text size="sm">{t('comum.user_menu.painel_admin')}</Text></Group>
              </UnstyledButton>
            )}
            <Divider my={4} />
            <UnstyledButton className="ud-action-btn" c="red" onClick={handleLogout}>
              <Group gap="xs"><IconLogout size={15} /><Text size="sm">{t('comum.user_menu.sair')}</Text></Group>
            </UnstyledButton>
          </Stack>
        )}

        <Text size="10px" c="dimmed" ta="center" mt="sm">
          {window.electronAPI ? t('comum.user_menu.desktop') : t('comum.user_menu.web')} · {t('comum.app_name')}
        </Text>
      </Popover.Dropdown>
    </Popover>
  )
}
