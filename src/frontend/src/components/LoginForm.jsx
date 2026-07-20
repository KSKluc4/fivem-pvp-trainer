import { useState } from 'react'
import { Card, TextInput, PasswordInput, Checkbox, Button, Stack, Group, Title, Text, Anchor, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { login } from '../services/api'
import BrandIcon from './BrandIcon'

function useFriendlyError() {
  const { t } = useTranslation()
  return (err) => {
    if (!err.response) return t('comum.erros.servidor_indisponivel')
    const msg = err.response?.data?.error || ''
    if (msg) return msg
    const code = err.response?.status
    if (code === 401) return t('auth.errors.senha_incorreta')
    if (code === 429) return t('comum.erros.muitas_tentativas')
    if (code >= 500) return t('comum.erros.erro_servidor')
    return t('comum.erros.erro_generico')
  }
}

export default function LoginForm({ onSuccess, onGoRegister, onForgotPassword }) {
  const { t } = useTranslation()
  const friendlyError = useFriendlyError()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const MAX = 5
    for (let attempt = 0; attempt < MAX; attempt++) {
      try {
        const res = await login({ identifier, password })
        onSuccess(res.data, remember)
        return
      } catch (err) {
        if (err.response || attempt === MAX - 1) {
          setError(friendlyError(err))
          break
        }
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    setLoading(false)
  }

  return (
    <div className="auth-screen">
      <Card w="100%" maw={400} p="xl" className="auth-card">
        <Stack align="center" gap={2} mb="lg">
          <div className="auth-card-icon"><BrandIcon size={48} /></div>
          <Title order={2} ta="center" mt="xs">{t('auth.login.title')}</Title>
          <Text c="dimmed" size="sm" ta="center">{t('auth.login.subtitle')}</Text>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput
              label={t('auth.login.identifier_label')}
              placeholder={t('auth.login.identifier_placeholder')}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
            <PasswordInput
              label={t('auth.login.password_label')}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Group justify="space-between" mt={2}>
              <Checkbox
                size="sm"
                label={t('auth.login.remember_me')}
                checked={remember}
                onChange={(e) => setRemember(e.currentTarget.checked)}
              />
              <Anchor component="button" type="button" size="sm" onClick={onForgotPassword}>
                {t('auth.login.forgot_password')}
              </Anchor>
            </Group>

            {error && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              size="md"
              fullWidth
              mt="xs"
              variant="gradient"
              gradient={{ from: 'brandCyan.5', to: 'brandPurple.5', deg: 120 }}
              className="auth-submit-btn"
              loading={loading}
              disabled={!identifier || !password}
            >
              {t('auth.login.submit')}
            </Button>
          </Stack>
        </form>

        <Text ta="center" size="sm" mt="lg" c="dimmed">
          {t('auth.login.no_account')}{' '}
          <Anchor component="button" type="button" onClick={onGoRegister} fw={700}>
            {t('auth.login.create_account')}
          </Anchor>
        </Text>
      </Card>
    </div>
  )
}
