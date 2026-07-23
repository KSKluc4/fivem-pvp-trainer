# Working rules — FiveM PvP Trainer

Regras permanentes de como Lucas e o Claude trabalham neste repo. Válidas até serem
explicitamente revistas aqui.

## 1. Papéis

- Arquitetura, specs e review de decisões de design acontecem em conversa (chat) entre
  Claude e Lucas — não dentro de uma sessão de implementação sem essa etapa prévia para
  qualquer mudança não-trivial.
- Implementação, testes, commits e releases são responsabilidade do Claude Code, a
  partir do que foi alinhado no chat ou definido em uma spec (`specs/SPEC-*.md`).

## 2. Migrations Supabase são sempre manuais

- Claude nunca aplica migrations com credenciais, nunca pede credenciais do Supabase, e
  nunca roda SQL contra o banco de produção/dev.
- O output de uma migration é sempre um arquivo `.sql` novo (`supabase_migration_vN.sql`)
  entregue para Lucas aplicar manualmente pelo painel do Supabase.

## 3. Deploy acontece antes do SQL

- Todo código que lê/escreve colunas ou tabelas introduzidas por uma migration ainda não
  aplicada precisa tolerar a ausência delas: fallback razoável (ex.: lista vazia, 503,
  "inconclusivo") + log, nunca uma exceção não tratada.
- Isso vale a partir do deploy do código, não só até a migration ser aplicada — o deploy
  do frontend/backend roda antes de Lucas rodar o SQL manualmente.

## 4. Secrets

- Nunca colar/pedir secrets (chaves Supabase, tokens, `.env`) em chat ou commitar em
  arquivo. Segredos só existem como env vars — no dashboard da Vercel ou via `vercel env`.

## 5. Retrocompatibilidade

- Qualquer mudança de schema ou formato de dado precisa continuar lendo/interpretando
  corretamente os dados legados já existentes (linhas antigas, formatos antigos de
  payload). Migração de dados existentes, quando necessária, é explícita e documentada,
  não assumida.

## 6. i18n

- Toda string nova de UI é adicionada em `src/frontend/src/locales/pt/translation.json`
  **e** `en/translation.json` na mesma mudança, com paridade de chaves (mesma chave
  presente nos dois arquivos).

## 7. Release

- Fluxo padrão: build do frontend + `npm test` (electron/frontend/api) verde + bump
  semver + commit + `npm run release`.
- Não fazer release quando a mudança não afeta o usuário final (refactor interno, docs,
  ajuste de dev tooling) — só o commit normal.

## 8. Specs para features grandes

- Features grandes chegam como `specs/SPEC-*.md`. Implementar exatamente o que está
  escrito. Se houver ambiguidade ou lacuna na spec, apontar antes de improvisar uma
  solução — não decidir por conta própria.
