import { useState } from 'react'
import { Card, TextInput, PasswordInput, Button, Stack, Title, Text, Anchor, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { login } from '../services/api'
import BrandLogo from './BrandLogo'

function friendlyError(err) {
  if (!err.response) return 'Servidor indisponível. Verifique sua conexão e tente novamente.'
  const msg = err.response?.data?.error || ''
  if (msg) return msg
  const code = err.response?.status
  if (code === 401) return 'Username ou senha incorretos.'
  if (code === 429) return 'Muitas tentativas. Aguarde um momento e tente novamente.'
  if (code >= 500) return 'Erro interno do servidor. Tente novamente em instantes.'
  return 'Ocorreu um erro. Tente novamente.'
}

export default function LoginForm({ onSuccess, onGoRegister }) {
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

        <Title order={2} mt="lg" mb={4}>Entrar</Title>
        <Text c="dimmed" size="sm" mb="xl">Acesse sua conta para continuar treinando</Text>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Username"
              placeholder="seu_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
            <PasswordInput
              label="Senha"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Button type="submit" size="md" fullWidth loading={loading} disabled={!username || !password}>
              Entrar →
            </Button>
          </Stack>
        </form>

        <Text ta="center" size="sm" mt="lg" c="dimmed">
          Não tem conta?{' '}
          <Anchor component="button" type="button" onClick={onGoRegister} fw={700}>
            Criar conta
          </Anchor>
        </Text>
      </Card>
    </div>
  )
}
