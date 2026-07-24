# SPEC-006 — Histórico de perfis de treino + 3 adições ao Dashboard

Status: **proposta — aguardando aprovação**. Implementação só começa após "aprovada, implemente a SPEC-006".

## Objetivo

Duas entregas independentes, sem remover nada do que já existe:

1. **Histórico de perfis de treino** — o usuário consegue ver os `questionnaire_results`
   anteriores (cada resposta do questionário que já deu), entender o resumo de cada um e
   "reativar" um perfil antigo (isso gera um **novo** registro — nunca edita o antigo — e
   regenera a rotina do dia com base nele).
2. **3 adições ao Dashboard** (`Progress.jsx`): card de recordes por drill, card de nível de
   mata-mata (com micro-histórico de quando subiu/desceu), e um mapa de atividade estilo
   GitHub dos últimos ~90 dias.

## Requisitos

1. Botão "Histórico de perfis" na tela Rotina do dia, ao lado de "Alterar perfil".
2. Lista paginada dos `questionnaire_results` do usuário, mais recente primeiro: data, resumo
   legível (focos — incluindo multi-select da SPEC-004 —, experiência, tempo/dia) e uma prévia
   da estrutura de rotina que aquele perfil geraria.
3. "Reativar este perfil": confirmação (avisa que a rotina de hoje será substituída) → cria uma
   **nova** linha em `questionnaire_results` (snapshot do perfil escolhido) → regenera a rotina
   do dia.
4. Endpoints novos com JWT, usuário só vê/reativa os próprios perfis; paginação simples.
5. Perfis legados (formatos antigos: valor único pré-SPEC-004, `server_type`/`main_weapon`
   ausentes nas linhas mais antigas) renderizam resumo sem erro e reativam corretamente — a
   cópia gravada respeita sempre o formato **novo**.
6. Dashboard ganha 3 cards novos (Recordes, Nível de mata-mata, Mapa de atividade) sem remover
   nenhum dos existentes.
7. Sem migration onde der — uma única exceção genuína, justificada abaixo (nível de mata-mata).
8. Critérios de aceite mensuráveis + Fora de escopo explícito.

## Fluxo

### Parte 1 — Histórico de perfis

```
TrainingRoutine.jsx
  novo botão "Histórico de perfis" (mesmo estilo subtle/gray de "Alterar perfil",
  logo ao lado — TrainingRoutine.jsx:196-203) → onHistoricoPerfis()
        │
        ▼
App.jsx: setView('historico_perfis')  (mesmo padrão de view === '...' já usado
                                        para 'progress'/'descobrir_sensibilidade')
        │
        ▼
HistoricoPerfis.jsx (novo componente)
  useEffect → GET /questionnaire/history?page=1&page_size=10
  lista de cards: data + resumo + prévia + botão "Reativar este perfil"
        │
        │ clique em "Reativar"
        ▼
  Modal de confirmação (Mantine `Modal`, não `window.confirm`):
  "Isso vai substituir a rotina de hoje. Continuar?"
        │ confirma
        ▼
  POST /questionnaire/history/<id>/reactivate
        │
        ▼
api/routes/questionnaire.py: reactivate_profile(profile_id)
  1. get_questionnaire_by_id(g.user_id, profile_id) → 404 se não existir/não for do usuário
  2. profile = normaliza a linha antiga pro formato NOVO (mesma lógica de
     _multi_or_legacy já usada em get_latest_questionnaire) → listas para
     focus_area/aim_difficulty/specific_weakness
  3. save_questionnaire(g.user_id, profile)   — grava uma linha NOVA (snapshot),
     nunca toca na antiga
  4. resolve_action_level(g.user_id, profile) — mesmo caminho de sempre
  5. generate_routine(profile, action_level=..., action_level_note=...)
  6. create_training_session(g.user_id, hoje, routine) — insere um novo registro
     em training_sessions para hoje (sem upsert hoje já, ver Edge cases)
  → mesmo shape de resposta de submit_questionnaire: {user_id, session_id, name, routine}
        │
        ▼
App.jsx reaproveita handleQuestionnaireComplete(data) — mesmo handler que o
questionário normal já usa (setSessionId/setRoutine/setView('routine'))
```

### Parte 2 — Dashboard

Os 3 cards são adições dentro de `Progress.jsx`, sem tocar no que já existe (streak, semana,
stats, evolução semanal, aim progress, taxa de conclusão, conquistas, histórico de sessões).

```
Progress.jsx
  useAllTrainerScores() (JÁ CARREGADO hoje pra "Aim Progress")
        → card "Recordes": reduz client-side, sem chamada nova (mesmo padrão que
          AimProgressSection já faz pra calcular `record`, Progress.jsx:252)

  useEffect novo → GET /progress/<userId>/action-level
        → card "Nível de mata-mata"

  useEffect novo → GET /progress/<userId>/heatmap?days=90
        → Mapa de atividade
```

## Banco

### Parte 1 — nenhuma migration

`questionnaire_results` já tem tudo que precisa (colunas legadas + `*_multi` da SPEC-004,
migration v12 — já aplicada). O histórico só precisa de **funções de leitura novas**, sem
alterar schema:

```python
# api/database.py

def list_questionnaire_history(user_id: int, limit: int = 10, offset: int = 0):
    sb = get_supabase()
    res = (sb.table('questionnaire_results')
             .select('*', count='exact')
             .eq('user_id', user_id)
             .order('created_at', desc=True)
             .range(offset, offset + limit - 1)
             .execute())
    rows = [_normalize_multi_fields(r) for r in (res.data or [])]
    return rows, (res.count or 0)


def get_questionnaire_by_id(user_id: int, profile_id: int):
    sb = get_supabase()
    res = (sb.table('questionnaire_results')
             .select('*')
             .eq('id', profile_id)
             .eq('user_id', user_id)   # ownership check embutido na própria query
             .limit(1)
             .execute())
    row = res.data[0] if res.data else None
    return _normalize_multi_fields(row) if row else None


def _normalize_multi_fields(row: dict) -> dict:
    row['focus_area']        = _multi_or_legacy(row, 'focus_area_multi', 'focus_area')
    row['aim_difficulty']    = _multi_or_legacy(row, 'aim_difficulty_multi', 'aim_difficulty')
    row['specific_weakness'] = _multi_or_legacy(row, 'specific_weakness_multi', 'specific_weakness')
    return row
```

`_normalize_multi_fields` é exatamente a lógica que hoje vive inline em
`get_latest_questionnaire` (`api/database.py`, chama `_multi_or_legacy` 3x) — extraída pra ser
reaproveitada aqui também. `get_latest_questionnaire` passa a chamar essa mesma função (sem
mudar seu comportamento externo, só removendo a duplicação).

A prévia de rotina de cada item da lista é calculada chamando `generate_routine(profile,
today=date.today())` (mesma função de sempre, pura, sem I/O) **com `aim_levels=None` e
`action_level=None`** — cai nos defaults já testados (`test_main_drills_default_to_medium_
difficulty_without_aim_data`, `test_action_level_defaults_from_experience_when_not_provided`).
Isso é uma prévia estrutural (quais drills, quantas partidas, duração total) — **não** reflete
o nível de mata-mata real nem o aim level real do usuário naquele momento (ver "Pontos a
confirmar").

### Parte 2a — Recordes: nenhuma migration, nenhum endpoint novo

Reaproveita os dados que `useAllTrainerScores()` já busca (usado pelo card "Aim Progress"
existente) — o mesmo `scoresByExercise[exerciseId]` (até 50 scores mais recentes por drill,
via `get_trainer_scores`) já dá pra reduzir a um "melhor score" client-side, exatamente como
`AimProgressSection` já faz na linha 252 do `Progress.jsx`. Mesma limitação de janela (últimos
50) que o card de Aim Progress já tem hoje — não é uma limitação nova introduzida por este
card (ver Edge cases).

### Parte 2b — Nível de mata-mata: **única migration desta spec**

`goal_levels` guarda só o nível ATUAL (`UNIQUE(user_id, category)`, upsert no lugar) —
`updated_at` já reflete corretamente "a última vez que o nível mudou de verdade" (porque
`resolve_action_level` só chama `upsert_goal_level` quando `existing is None` OU quando o nível
realmente muda — nunca em um dia sem mudança), mas **não existe nenhuma forma de saber a
DIREÇÃO** (subiu ou desceu) sem saber o valor anterior — e isso não está armazenado em lugar
nenhum. Não dá pra derivar isso do schema atual. Migration mínima, uma coluna nullable:

```sql
-- Migration v13: rastrear a última transição de nível do goal_levels (mata-mata)
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new
--
-- goal_levels.updated_at já só é tocado quando o nível muda de verdade (ver
-- level_service.resolve_action_level) — o que falta é saber DE ONDE ele mudou,
-- pra derivar a direção (subiu/desceu) no card "Nível de mata-mata" do dashboard.
-- Sem essa coluna, o histórico "subiu/desceu por último quando" não é derivável.

ALTER TABLE IF EXISTS goal_levels
  ADD COLUMN IF NOT EXISTS previous_level INT
    CHECK (previous_level IS NULL OR previous_level BETWEEN 1 AND 5);
```

`previous_level IS NULL` = "nunca mudou de verdade ainda" (só a atribuição inicial) — o card
não mostra nenhuma linha de "mudou em" nesse caso, só o nível atual + cota.

```python
# api/database.py — upsert_goal_level ganha um parâmetro opcional

def upsert_goal_level(user_id: int, category: str, level: int, previous_level: int = None):
    sb = get_supabase()
    payload = {'user_id': user_id, 'category': category, 'current_level': level,
               'updated_at': datetime.utcnow().isoformat()}
    if previous_level is not None:
        payload['previous_level'] = previous_level
    try:
        sb.table('goal_levels').upsert(payload, on_conflict='user_id,category').execute()
    except Exception:
        # migration v13 ainda não aplicada — grava sem a coluna nova, como antes
        traceback.print_exc()
        payload.pop('previous_level', None)
        sb.table('goal_levels').upsert(payload, on_conflict='user_id,category').execute()


def get_action_level_summary(user_id: int):
    sb = get_supabase()
    res = (sb.table('goal_levels').select('*')
             .eq('user_id', user_id).eq('category', 'action').limit(1).execute())
    row = res.data[0] if res.data else None
    if row is None:
        return None
    level          = row['current_level']
    previous_level = row.get('previous_level')  # ausente/None em linha legada ou 1ª atribuição
    direction = None
    if previous_level is not None:
        direction = 'up' if level > previous_level else 'down' if level < previous_level else None
    return {
        'level':          level,
        'quota':          KILLS_PER_MATCH_BY_LEVEL[level],
        'previous_level': previous_level,
        'changed_at':     row.get('updated_at') if previous_level is not None else None,
        'direction':      direction,
    }
```

`get_action_level_summary` usa `select('*')` (tolera a coluna nova ausente sem erro — só não
vem no dict). `get_goal_level`/`resolve_action_level` (usados na geração da rotina em si) **não
são alterados** — só o novo parâmetro opcional em `upsert_goal_level`, e uma chamada a mais em
`resolve_action_level` passando `previous_level=current_level` no branch onde o nível muda de
verdade:

```python
# api/services/level_service.py — resolve_action_level, único trecho que muda
        if existing is None:
            upsert_goal_level(user_id, CATEGORY, new_level)          # sem previous_level — 1ª atribuição
        elif new_level != current_level:
            upsert_goal_level(user_id, CATEGORY, new_level, previous_level=current_level)
```

### Parte 2c — Mapa de atividade: nenhuma migration

`training_sessions.routine` (JSONB) já guarda a rotina completa daquele dia — dá pra contar
quantos exercícios eram "checkable" (`sections[].checkable == True`, i.e. `treino_principal` +
`aplicacao_jogo` — ver `routine_generator.py`) sem precisar de coluna nova. Junto com a contagem
de `progress` (já usada por `get_progress_history`), dá pra classificar cada dia em 3 estados
sem schema novo:

```python
def get_activity_heatmap(user_id: int, days: int = 90):
    from collections import Counter
    sb = get_supabase()
    since = (date.today() - timedelta(days=days - 1)).isoformat()

    sessions_res = (sb.table('training_sessions')
                      .select('id,date,routine,created_at')
                      .eq('user_id', user_id)
                      .gte('date', since)
                      .order('created_at', desc=True)
                      .execute())

    # Mais de uma sessão no mesmo dia (ex.: reativar um perfil hoje — Parte 1)
    # → fica só a mais recente, mesmo critério que get_today_session já usa.
    latest_by_date = {}
    for s in (sessions_res.data or []):
        latest_by_date.setdefault(s['date'], s)

    session_ids = [s['id'] for s in latest_by_date.values()]
    progress_res = (sb.table('progress').select('session_id')
                       .in_('session_id', session_ids)
                       .neq('exercise_name', '__session__')
                       .execute()) if session_ids else None
    done_counts = Counter(p['session_id'] for p in (progress_res.data or [])) if progress_res else Counter()

    result = []
    for day, s in latest_by_date.items():
        sections = (s.get('routine') or {}).get('sections', [])
        total    = sum(len(sec.get('exercises', [])) for sec in sections if sec.get('checkable'))
        done     = done_counts.get(s['id'], 0)
        if total <= 0 or done <= 0:
            state = 'none'
        elif done >= total:
            state = 'complete'
        else:
            state = 'partial'
        result.append({'date': day, 'exercises_done': done, 'exercises_total': total, 'state': state})
    return result
```

Dias sem nenhuma linha em `training_sessions` simplesmente não aparecem na lista — o frontend
preenche os dias faltantes da janela de 90 dias como `'none'` (equivalente: 0 feito de 0/0).

## UI

### Parte 1 — `HistoricoPerfis.jsx` (novo)

- Header igual ao padrão das outras telas (título + botão voltar pra `'routine'`).
- Lista de `Card`s, um por perfil, mais recente primeiro:
  - Data (`created_at`, formatada como as demais telas — `formatDate` já existe em
    `Progress.jsx`, mover pra um util compartilhado ou duplicar a função de 4 linhas).
  - Resumo: badges reaproveitando as MESMAS chaves de i18n que o questionário já usa
    (`questionario.perguntas.focus_area.opcoes.<value>.label`, idem `aim_difficulty` e
    `specific_weakness`) — com **todas** as escolhas quando houver 2 (SPEC-004), não só a
    primeira. Mais: `experience_level`, `daily_time` (minutos/dia).
  - Prévia: uma linha de texto tipo "Aquecimento: {warmup} · Principal: {main1} + {main2} ·
    {match_count} partida(s) · ~{total_duration} min" — nomes de exercício via
    `trainer.exercicios.<id>.nome` (chave já existente).
  - Botão "Reativar este perfil" (`Button` outline/light) — abre o `Modal` de confirmação.
  - O item de índice 0 na página 1 é o perfil ATUALMENTE ativo (mesma linha que
    `get_latest_questionnaire` devolveria) — badge "Perfil atual", sem precisar de campo novo
    no backend (é só a posição).
- Paginação: `Pagination` do Mantine, `page_size=10`, usando `total` da resposta.
- Estado vazio: usuário sem nenhum `questionnaire_results` ainda (não deveria acontecer na
  prática, já que chegar em "Rotina do dia" pressupõe ter respondido — mas cobrir mesmo assim)
  → mensagem simples, sem lista.

Chaves de locale novas (PT/EN): `rotina.historico_perfis` (label do botão),
`historico_perfis.titulo`, `.perfil_atual`, `.reativar`, `.reativar_confirmar_titulo`,
`.reativar_confirmar_corpo`, `.reativar_sucesso`, `.preview_texto` (com placeholders),
`.vazio`.

### Parte 2 — Dashboard

**Card "Recordes"** (`Progress.jsx`, ao lado/abaixo do card "Aim Progress" existente):
```jsx
<Card mb="lg">
  <Group gap={6} mb="md"><IconTrophy .../><Text>{t('dashboard.recordes.titulo')}</Text></Group>
  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
    {EXERCISE_IDS.map((id) => {
      const scores = scoresByExercise[id] || []
      const best = scores.reduce((b, s) => (b == null || s.score > b ? s.score : b), null)
      return (
        <Paper key={id} p="sm" ta="center" withBorder>
          <Text size="xs" c="dimmed">{t(`trainer.exercicios.${id}.nome`)}</Text>
          <Text fw={900} size="1.2rem" c="brandCyan">{best ?? '—'}</Text>
          {best == null && <Text size="xs" c="dimmed">{t('trainer.card.sem_tentativas')}</Text>}
        </Paper>
      )
    })}
  </SimpleGrid>
</Card>
```
Reaproveita a chave `trainer.card.sem_tentativas` ("Ainda não treinado") já existente pro
estado vazio — sem chave nova aí.

**Card "Nível de mata-mata":**
```jsx
<Card mb="lg">
  <Group gap={6} mb="md"><IconSwords .../><Text>{t('dashboard.nivel_matamata.titulo')}</Text></Group>
  <Group gap="xl">
    <Box><Text c="dimmed" size="xs">{t('dashboard.nivel_matamata.nivel')}</Text><Text fw={900} size="1.4rem">{actionLevel.level}</Text></Box>
    <Box><Text c="dimmed" size="xs">{t('dashboard.nivel_matamata.cota')}</Text><Text fw={900} size="1.4rem">{actionLevel.quota}</Text></Box>
  </Group>
  {actionLevel.direction && (
    <Text size="xs" c={actionLevel.direction === 'up' ? 'green' : 'red'} mt={6}>
      {t(`dashboard.nivel_matamata.${actionLevel.direction}`, { date: formatDate(actionLevel.changed_at) })}
    </Text>
  )}
</Card>
```
Sem `direction` (perfil recém-criado, ou migration v13 não aplicada) → só mostra nível + cota,
sem a linha de histórico — degrada graciosamente, nunca quebra.

**Mapa de atividade** — grade estilo GitHub, sem lib nova (nenhum heatmap pronto no repo hoje
— ver pesquisa): 7 linhas (dias da semana) × ~13 colunas (semanas), célula = `Paper` pequeno
(`~14px`), cor por estado:
- `none` → cinza neutro (mesmo tom da bolinha "○" vazia do calendário semanal existente).
- `partial` → laranja claro (`var(--mantine-color-orange-4)`, tom mais fraco).
- `complete` → verde (`var(--mantine-color-green-6)`, mesmo tom já usado em "Últimos 7 Dias").

`Tooltip` do Mantine por célula: data formatada + "`{done}/{total} exercícios`" (ou
"nenhum treino" quando `state === 'none'` e não há sessão nesse dia). Layout: semanas mais
recentes à direita (convenção GitHub), preenchendo os dias sem sessão como `none`.

## Edge cases

| Cenário | Comportamento esperado |
|---|---|
| Perfil no histórico é de antes da SPEC-004 (`*_multi` NULL) | `_normalize_multi_fields` cai pro fallback de sempre — resumo mostra 1 badge por campo, normal. |
| Perfil no histórico é de antes de `main_weapon`/`specific_weakness` existirem (`''`) | Badge daquele campo simplesmente não renderiza (string vazia = "sem resposta"), sem erro. |
| Reativar um perfil enquanto já existe uma sessão de hoje | `create_training_session` insere uma 2ª linha pra hoje (sem upsert — comportamento já existente, não introduzido por esta spec); `get_today_session`/o heatmap já pegam sempre a mais recente por data, então não há inconsistência visível — mas fica uma linha "órfã" mais antiga no banco (mesmo já acontece hoje em qualquer double-submit). |
| Reativar o perfil que já é o atual (item índice 0, página 1) | Permitido — só cria um novo snapshot idêntico e regenera a rotina (pode mudar o `action_level` se a adaptação de dificuldade tiver avançado nesse meio-tempo). |
| `profile_id` do reactivate não existe ou é de outro usuário | 404 — a própria query já filtra por `user_id`, então "não existe" e "não é seu" são indistinguíveis de propósito (não vaza que o ID existe). |
| Usuário com só 1 perfil no histórico | Lista com 1 item, sem paginação visível (ou `Pagination` com 1 página só). |
| `goal_levels` sem nenhuma linha ainda (usuário nunca gerou rotina) | `get_action_level_summary` retorna `None` — card mostra estado vazio ("ainda sem partidas de mata-mata registradas"), não quebra. |
| Migration v13 não aplicada | `previous_level` nunca é lido/gravado (tratado como sempre ausente) — card de nível funciona normalmente, só sem a linha de "mudou em". |
| Dia com sessão mas `exercises_total == 0` (rotina antiga/degenerada sem seções checkable) | Tratado como `'none'` (evita divisão por zero e um "completo" enganoso). |
| Usuário tem mais de 50 registros de score num drill (janela do "Recorde") | Mesma limitação que o card "Aim Progress" já tem hoje (best-of-últimos-50) — não é uma regressão nova, documentado aqui pra não ser reportado como bug depois. |
| Heatmap: dia com sessão mas 0 progress rows | `done=0` → `'none'` (mesmo critério de "nada feito", independente de existir uma linha em `training_sessions`). |

## Critérios de aceite

1. `GET /questionnaire/history` retorna só perfis do usuário autenticado, ordenados por
   `created_at desc`, paginados (`page`, `page_size`, `total` na resposta).
2. Cada item da lista traz `focus_area`/`aim_difficulty`/`specific_weakness` como **array**
   (1 ou 2 itens), independente de a linha ser antiga (1 item) ou nova (1-2 itens).
3. Cada item traz uma prévia (`preview`) com pelo menos: drills do treino principal, número de
   partidas, duração total — calculada sem persistir nada.
4. `POST /questionnaire/history/<id>/reactivate` com um `id` de outro usuário (ou inexistente)
   retorna `404`.
5. `POST /questionnaire/history/<id>/reactivate` bem-sucedido: (a) cria uma linha NOVA em
   `questionnaire_results` (a contagem de linhas do usuário aumenta em 1; a linha antiga
   permanece inalterada byte a byte); (b) `GET /training/<user_id>` (ou a resposta imediata do
   próprio reactivate) reflete a rotina do perfil reativado.
6. Reativar um perfil que tem 2 valores de `aim_difficulty` gera uma rotina cobrindo os dois
   (mesma garantia da SPEC-004 — sem reimplementar nada, só confirma que o caminho novo chama
   `generate_routine` do mesmo jeito).
7. `GET /progress/<user_id>/action-level` para um usuário sem `goal_levels` ainda retorna um
   corpo indicando ausência (não um erro 500).
8. Após uma transição real de nível (`resolve_action_level` muda o nível), a próxima chamada a
   `GET /progress/<user_id>/action-level` retorna `direction` (`'up'` ou `'down'`) e
   `changed_at` preenchidos; antes de qualquer transição, ambos vêm nulos.
9. `GET /progress/<user_id>/heatmap?days=90` retorna no máximo 1 entrada por `date` (nunca 2
   linhas pro mesmo dia, mesmo se `training_sessions` tiver mais de uma).
10. Um dia com todos os exercícios `checkable` concluídos aparece como `'complete'`; com só
    alguns, `'partial'`; sem nenhum (ou sem sessão), `'none'`.
11. Card "Recordes" mostra `'—'` + o texto de "ainda não treinado" pra qualquer drill sem
    nenhum score, sem quebrar os outros 3 cards.
12. Nenhum card/seção existente do Dashboard (streak, semana, stats, evolução semanal, aim
    progress, taxa de conclusão, conquistas, histórico de sessões) muda de posição, dado ou
    comportamento.
13. `npm test` (JS completo + `test:api`) verde, com testes novos cobrindo pelo menos: listagem
    paginada, reactivate (sucesso + 404 de outro usuário), `_normalize_multi_fields` com linha
    legada e com linha nova, `get_activity_heatmap` classificando os 3 estados, e
    `get_action_level_summary` com/sem `previous_level`.

## Fora de escopo

- Editar ou apagar perfis antigos — só existe "ver" e "reativar" (que sempre cria um snapshot
  novo).
- Comparar 2+ perfis lado a lado.
- Qualquer mudança na lógica de geração de rotina em si (`generate_routine` é só chamado, não
  alterado) ou nas regras de dificuldade adaptativa (`adjust_level`).
- Histórico de mudança de nível para qualquer `category` além de `'action'` (não existe outro
  uso ativo hoje).
- O card "Recordes" filtrar/segmentar por dificuldade — mostra o melhor score entre todas.
- O mapa de atividade detalhar por exercício (é um resumo do dia inteiro, não por drill).
- Migrar/recalcular dados de `goal_levels` já existentes — `previous_level` fica `NULL` pra
  quem já tinha uma linha antes da migration v13 (sem "mudou em" até a próxima transição real).
- Paginação avançada (infinite scroll, cache, pré-fetch) — `Pagination` simples baseada em
  `page`/`page_size`.
- Qualquer alteração no Admin Panel.

## Pontos a confirmar antes da implementação

1. **Prévia de rotina com `aim_levels=None`/`action_level=None`** — mostra QUAIS drills e
   QUANTAS partidas, mas não a dificuldade real nem o nível de mata-mata real do usuário
   naquele momento (isso mudaria dependendo de quando a prévia for calculada, não do perfil em
   si). Se preferir que a prévia mostre o nível/dificuldade atuais reais do usuário em vez de
   defaults, é possível, mas exigiria repetir as mesmas chamadas de `resolve_action_level`/
   `compute_per_exercise_levels` para cada item da página (mais caro, ainda sem I/O de escrita).
2. **Migration v13 (`goal_levels.previous_level`)** — única exceção à meta de "sem migration",
   estritamente necessária pra derivar a direção da última mudança de nível (não tem outro
   jeito com o schema atual).
3. **Critério de "completo" do heatmap** (`exercises_done >= exercises_total` checkable)
   ignora deliberadamente a flag `training_sessions.completed` (que hoje só significa "usuário
   clicou Finalizar com pelo menos 1 exercício marcado", não "100% concluído" — ver
   `TrainingRoutine.jsx`, `disabled={completedCount === 0}`). Isso pode divergir visualmente do
   badge "Completo"/"Em andamento" que a lista de "Histórico" já mostra hoje (baseado só na
   flag `completed`) — mantendo os dois critérios coexistindo (o heatmap é mais rigoroso), a
   menos que prefira unificar os dois em uma futura spec.
4. **Botão "Histórico de perfis" como item separado** ao lado de "Alterar perfil" (não
   integrado dentro do fluxo do questionário) — se preferir integrá-lo como uma aba/opção
   dentro da tela de "Alterar perfil" em vez de um botão próprio, é uma mudança pequena no
   ponto de entrada, sem afetar o resto da spec.
