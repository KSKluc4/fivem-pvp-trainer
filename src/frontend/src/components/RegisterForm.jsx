import { useState } from 'react'
import { Card, TextInput, PasswordInput, Button, Stack, Title, Text, Anchor, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { register } from '../services/api'
import BrandLogo from './BrandLogo'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function friendlyError(err) {
  if (!err.response) return 'Servidor indisponível. Verifique sua conexão e tente novamente.'
  const msg = err.response?.data?.error || ''
  if (msg) return msg
  const code = err.response?.status
  if (code === 409) return 'Este username já está em uso. Escolha outro.'
  if (code === 400) return 'Dados inválidos. Verifique os campos e tente novamente.'
  if (code >= 500) return 'Erro interno do servidor. Tente novamente em instantes.'
  return 'Ocorreu um erro. Tente novamente.'
}

export default function RegisterForm({ onSuccess, onGoLogin }) {
  const [form,    setForm]    = useState({ name: '', username: '', email: '', password: '' })
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!EMAIL_RE.test(form.email)) {
      setError('Email inválido.')
      return
    }

    setLoading(true)
    const MAX = 5
    for (let attempt = 0; attempt < MAX; attempt++) {
      try {
        const res = await register(form)
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

        <Title order={2} mt="lg" mb={4}>Criar conta</Title>
        <Text c="dimmed" size="sm" mb="xl">Comece sua jornada de treino personalizado</Text>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Nome completo"
              placeholder="João Silva"
              value={form.name}
              onChange={set('name')}
              autoFocus
              autoComplete="name"
              required
            />
            <TextInput
              label="Username"
              description="Mínimo 3 caracteres"
              placeholder="joaosilva"
              value={form.username}
              onChange={set('username')}
              autoComplete="username"
              minLength={3}
              required
            />
            <TextInput
              label="Email"
              type="email"
              placeholder="voce@exemplo.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
            <PasswordInput
              label="Senha"
              description="Mínimo 6 caracteres"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              minLength={6}
              required
            />

            {error && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              size="md"
              fullWidth
              loading={loading}
              disabled={!form.name || !form.username || !form.email || !form.password}
            >
              Criar conta →
            </Button>
          </Stack>
        </form>

        <Text ta="center" size="sm" mt="lg" c="dimmed">
          Já tem conta?{' '}
          <Anchor component="button" type="button" onClick={onGoLogin} fw={700}>
            Entrar
          </Anchor>
        </Text>
      </Card>
    </div>
  )
}
