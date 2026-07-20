import { useState, useEffect } from 'react'
import {
  Box, Group, Stack, Text, Title, Button, Card, Avatar, FileButton, ActionIcon,
  Progress as MProgress, Alert, SimpleGrid, Skeleton, Textarea, Paper,
} from '@mantine/core'
import {
  IconArrowLeft, IconCamera, IconTrash, IconAlertCircle, IconFlame,
  IconTargetArrow, IconClipboardList,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import {
  getMe, updateBio, uploadAvatar, uploadBanner, deleteAvatar, deleteBanner,
} from '../services/api'
import { toast } from '../services/toast'
import { initials, avatarHue } from '../services/avatar'
import { useAllTrainerScores } from '../trainer/useAllTrainerScores'
import { EXERCISE_IDS } from '../trainer/scenarios/index.js'
import { exerciseAimLevel, overallAimLevel } from '../trainer/aimLevel.js'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const BANNER_MAX_BYTES = 4 * 1024 * 1024
const BIO_MAX_LEN = 200

// Shared client-side upload flow for both avatar and banner: pick → validate
// (type/size, mirroring the backend's own checks so bad files never leave the
// browser) → local preview → confirm uploads with progress → `onChange`
// bubbles the new (or null, on remove) URL up to the parent's state.
function useImageUpload({ maxBytes, uploadFn, removeFn, onChange, t }) {
  const [file, setFile]             = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState(0)
  const [error, setError]           = useState(null)

  const pick = (selected) => {
    setError(null)
    if (!selected) return
    if (!ALLOWED_MIME.includes(selected.type)) {
      setError(t('perfil.erro_tipo'))
      return
    }
    if (selected.size > maxBytes) {
      setError(t('perfil.erro_tamanho', { mb: Math.round(maxBytes / (1024 * 1024)) }))
      return
    }
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const cancel = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setError(null)
  }

  const confirm = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    setProgress(0)
    try {
      const res = await uploadFn(file, setProgress)
      onChange(res.data.avatar_url ?? res.data.banner_url ?? null)
      cancel()
    } catch (err) {
      setError(err.response?.data?.error || t('perfil.erro_upload'))
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    try {
      await removeFn()
      onChange(null)
    } catch (err) {
      toast.error(err.response?.data?.error || t('perfil.erro_upload'))
    }
  }

  return { previewUrl, uploading, progress, error, pick, cancel, confirm, remove }
}

export default function Profile({ user, onUserUpdate, onBack }) {
  const { t } = useTranslation()
  const [me, setMe]           = useState(null)
  const [loading, setLoading] = useState(true)
  const [bio, setBio]         = useState('')
  const [bioSaving, setBioSaving] = useState(false)
  const { scoresByExercise } = useAllTrainerScores()

  useEffect(() => {
    getMe()
      .then((res) => { setMe(res.data); setBio(res.data.bio || '') })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const avatarUpload = useImageUpload({
    maxBytes: AVATAR_MAX_BYTES, uploadFn: uploadAvatar, removeFn: deleteAvatar, t,
    onChange: (url) => { setMe((m) => ({ ...m, avatar_url: url })); onUserUpdate?.({ avatar_url: url }) },
  })
  const bannerUpload = useImageUpload({
    maxBytes: BANNER_MAX_BYTES, uploadFn: uploadBanner, removeFn: deleteBanner, t,
    onChange: (url) => setMe((m) => ({ ...m, banner_url: url })),
  })

  const saveBio = async () => {
    setBioSaving(true)
    try {
      const res = await updateBio(bio.trim())
      setMe((m) => ({ ...m, bio: res.data.bio }))
      setBio(res.data.bio)
      toast.success(t('perfil.bio_salva'))
    } catch (err) {
      toast.error(err.response?.data?.error || t('perfil.erro_upload'))
    } finally {
      setBioSaving(false)
    }
  }

  if (loading || !me) {
    return (
      <Box className="profile-view">
        <Skeleton height={36} width="30%" mb="lg" />
        <Skeleton height={280} mb="lg" />
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={90} />)}
        </SimpleGrid>
      </Box>
    )
  }

  const hue   = avatarHue(user.username)
  const inits = initials(user.name)

  const perExerciseLevels = Object.fromEntries(
    EXERCISE_IDS.map((id) => [id, exerciseAimLevel(scoresByExercise[id] || [])]),
  )
  const aimLevel = overallAimLevel(perExerciseLevels)

  const bannerImg = bannerUpload.previewUrl || me.banner_url
  const avatarImg = avatarUpload.previewUrl || me.avatar_url

  return (
    <Box className="profile-view">
      <Group justify="space-between" mb="lg">
        <Title order={1}>{t('perfil.titulo')}</Title>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('perfil.voltar_ao_treino')}
        </Button>
      </Group>

      <Card p={0} mb="lg" className="profile-card">
        <Box
          className={`profile-banner${bannerImg ? '' : ' profile-banner--placeholder'}`}
          style={bannerImg ? { backgroundImage: `url(${bannerImg})` } : undefined}
        >
          <div className="profile-banner-actions">
            {me.banner_url && !bannerUpload.previewUrl && (
              <ActionIcon variant="filled" color="dark" onClick={bannerUpload.remove} title={t('perfil.remover_banner')}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
            <FileButton onChange={bannerUpload.pick} accept={ACCEPT}>
              {(props) => (
                <ActionIcon {...props} variant="filled" color="dark" title={t('perfil.trocar_banner')}>
                  <IconCamera size={16} />
                </ActionIcon>
              )}
            </FileButton>
          </div>

          <div className="profile-avatar-wrap">
            <Avatar
              src={avatarImg || undefined}
              size={96}
              radius="50%"
              className="profile-avatar"
              style={{ background: `hsl(${hue}, 70%, 40%)` }}
            >
              {inits}
            </Avatar>
            <FileButton onChange={avatarUpload.pick} accept={ACCEPT}>
              {(props) => (
                <ActionIcon {...props} size="sm" radius="xl" variant="filled" color="brandCyan" className="profile-avatar-camera" title={t('perfil.trocar_avatar')}>
                  <IconCamera size={14} />
                </ActionIcon>
              )}
            </FileButton>
          </div>
        </Box>

        <Stack gap={4} p="lg" pt={56}>
          {bannerUpload.previewUrl && (
            <Group gap="xs" mb="xs">
              {bannerUpload.uploading ? (
                <MProgress value={bannerUpload.progress} size="sm" style={{ flex: 1 }} />
              ) : (
                <>
                  <Button size="xs" onClick={bannerUpload.confirm}>{t('comum.salvar')}</Button>
                  <Button size="xs" variant="light" color="gray" onClick={bannerUpload.cancel}>{t('comum.cancelar')}</Button>
                </>
              )}
            </Group>
          )}
          {bannerUpload.error && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={14} />} mb="xs" p="xs">{bannerUpload.error}</Alert>
          )}

          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={800} size="lg">{user.name}</Text>
              <Text size="sm" c="dimmed">@{user.username}</Text>
            </div>
            {me.avatar_url && !avatarUpload.previewUrl && (
              <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={avatarUpload.remove}>
                {t('perfil.remover_avatar')}
              </Button>
            )}
          </Group>

          {avatarUpload.previewUrl && (
            <Group gap="xs" mt="xs">
              {avatarUpload.uploading ? (
                <MProgress value={avatarUpload.progress} size="sm" style={{ flex: 1 }} />
              ) : (
                <>
                  <Button size="xs" onClick={avatarUpload.confirm}>{t('comum.salvar')}</Button>
                  <Button size="xs" variant="light" color="gray" onClick={avatarUpload.cancel}>{t('comum.cancelar')}</Button>
                </>
              )}
            </Group>
          )}
          {avatarUpload.error && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={14} />} mt="xs" p="xs">{avatarUpload.error}</Alert>
          )}

          <Textarea
            mt="md"
            placeholder={t('perfil.bio_placeholder')}
            value={bio}
            maxLength={BIO_MAX_LEN}
            autosize
            minRows={2}
            maxRows={4}
            onChange={(e) => setBio(e.target.value)}
          />
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">{bio.length}/{BIO_MAX_LEN}</Text>
            <Button size="xs" onClick={saveBio} loading={bioSaving} disabled={bio === (me.bio || '')}>
              {t('comum.salvar')}
            </Button>
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
        <StatCard number={me.stats.streak} label={t('perfil.stats.streak')} icon={IconFlame} color="orange" />
        <StatCard number={aimLevel != null ? aimLevel.toFixed(1) : '—'} label={t('perfil.stats.nivel_aim')} icon={IconTargetArrow} color="brandCyan" />
        <StatCard number={me.stats.sessions_completed} label={t('perfil.stats.sessoes')} icon={IconClipboardList} color="green" />
      </SimpleGrid>
    </Box>
  )
}

function StatCard({ number, label, icon: Icon, color }) {
  return (
    <Paper p="md" ta="center">
      <Icon size={22} color={`var(--mantine-color-${color}-5)`} />
      <Text fw={900} size="1.4rem" c={color}>{number}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </Paper>
  )
}
