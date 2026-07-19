import { useState } from 'react'
import { Card, TextInput, PasswordInput, Button, Stack, Title, Text, Anchor, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { login } from '../services/api'
import BrandLogo from './BrandLogo'

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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const MAX = 5
    for (let attempt = 0; attempt < MAX; attempt++) {
      try {
        const res = await login({ username, password })
        onSuccess(res.data)
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
      <Card w="100%" maw={420} p="xl">
        <BrandLogo />

        <Title order={2} mt="lg" mb={4}>{t('auth.login.title')}</Title>
        <Text c="dimmed" size="sm" mb="xl">{t('auth.login.subtitle')}</Text>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label={t('auth.login.username_label')}
              placeholder={t('auth.login.username_placeholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

            <Anchor component="button" type="button" size="sm" onClick={onForgotPassword} style={{ alignSelf: 'flex-start' }}>
              {t('auth.login.forgot_password')}
            </Anchor>

            {error && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Button type="submit" size="md" fullWidth loading={loading} disabled={!username || !password}>
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
