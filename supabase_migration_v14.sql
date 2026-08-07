-- Migration v14: rate limiting + Row Level Security
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new
--
-- Itens 1 e 3 da auditoria de segurança. Seguro de rodar mais de uma vez.
--
-- ORDEM: rode este SQL ANTES do deploy do backend. O código tolera a ausência
-- da tabela (services/rate_limit.py deixa passar e loga), mas até o SQL rodar
-- não existe rate limiting nenhum — que é justamente o furo crítico.

-- ── 1. RATE LIMITING ─────────────────────────────────────────────────────────
--
-- Contador compartilhado entre as instâncias da função na Vercel. Não pode
-- viver em memória: cada requisição pode cair numa cópia nova e fria da
-- função serverless, então um contador de processo zeraria sozinho.
--
-- `bucket` é o que está sendo contado, no formato '<rota>:ip:<ip>' — ex.:
-- 'login:ip:203.0.113.9'. Uma linha por requisição aceita; as antigas são
-- descartadas pelo cron diário (/api/health chama purge_old_hits).
CREATE TABLE IF NOT EXISTS rate_limit_hits (
    id         BIGSERIAL   PRIMARY KEY,
    bucket     TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice na ordem exata da consulta de check_and_hit
-- (WHERE bucket = ? AND created_at >= ?).
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_time
    ON rate_limit_hits (bucket, created_at DESC);


-- ── 2. ROW LEVEL SECURITY ────────────────────────────────────────────────────
--
-- Até aqui TODAS as tabelas estavam com RLS explicitamente desligado, sob a
-- justificativa de que "a service_role ignora RLS de qualquer jeito" — o que é
-- verdade, mas deixa a chave pública (anon) como único obstáculo. Hoje essa
-- chave não está exposta em lugar nenhum (o bundle do frontend foi varrido),
-- então isso não é explorável de fora; mas no dia em que ela vazar, sem RLS
-- quem tiver ela lê e escreve nas 12 tabelas, inclusive users, sessions e
-- password_reset_tokens.
--
-- ZERO POLICIES É DE PROPÓSITO. Não existe Supabase Auth neste projeto: a
-- autenticação é JWT próprio (api/utils.py) e user_id é INTEGER, não o UUID de
-- auth.users — uma policy com auth.uid() seria sempre nula e não funcionaria.
-- Nenhum cliente fala com o PostgREST: todo acesso passa pelo backend Flask com
-- a service_role, que tem BYPASSRLS. Portanto o correto aqui é "RLS ligado,
-- ninguém além dela entra". Nada no api/ precisa mudar.
--
-- Percorrer pg_tables em vez de um ALTER por linha: ALTER TABLE numa tabela
-- inexistente abortaria o script inteiro, e algumas destas são de features
-- já removidas (goals, user_servers, sensitivity_conversions) que podem ou
-- não estar presentes. Assim também cobre qualquer tabela criada depois.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND rowsecurity = FALSE
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    RAISE NOTICE 'RLS ligado em %', t;
  END LOOP;
END$$;


-- ── 3. REVOGAR OS GRANTS PADRÃO ──────────────────────────────────────────────
--
-- Cinto e suspensório: o Supabase concede SELECT/INSERT/UPDATE/DELETE aos
-- papéis anon/authenticated em todo o schema public por padrão. Sem policy o
-- RLS já bloqueia, mas revogar torna explícito e cobre tabelas futuras.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;


-- ── 4. CONFERÊNCIA ───────────────────────────────────────────────────────────
--
-- Rode isto depois: todas as linhas devem vir com rowsecurity = true.
--
--   SELECT tablename, rowsecurity
--     FROM pg_tables
--    WHERE schemaname = 'public'
--    ORDER BY tablename;
--
-- E o bucket de storage 'profiles' continua com leitura pública de propósito
-- (avatares/banners), sem policy de escrita para anon — inalterado pela v14.
