# SPEC-004 — Multi-select (até 2) no questionário: dificuldade específica, pilar do gameplay, tipo de mira

Status: **proposta — aguardando aprovação**. Implementação só começa após "aprovada, implemente a SPEC-004".

## Objetivo

Permitir que o usuário escolha **até 2 opções** (em vez de 1) nas 3 perguntas do questionário onde
mais de um problema/foco costuma ser verdade ao mesmo tempo:

- `specific_weakness` — "Qual é sua maior dificuldade específica?"
- `focus_area` — "Em qual pilar do seu gameplay você quer focar?"
- `aim_difficulty` — "Que tipo de mira é mais difícil para você?"

As outras 4 perguntas (`experience_level`, `reflex_level`, `movement_quality`, `daily_time`)
continuam escolha única — não são tocadas por esta spec.

A rotina gerada deve refletir as duas escolhas quando houver 2 (treino principal cobre os dois
focos de mira; as partidas de mata-mata priorizam os pilares escolhidos), sem quebrar nada para
quem continua escolhendo 1 (comportamento atual = regressão golden) nem para dados/linhas já
existentes no banco.

## Requisitos

1. UI multi-select (até 2) nas 3 perguntas acima; demais perguntas inalteradas.
2. Armazenamento retrocompatível: colunas atuais (`focus_area`, `aim_difficulty`,
   `specific_weakness`, todas `TEXT` em `questionnaire_results`) continuam recebendo a
   **primeira escolha** — qualquer código/consulta legada (incluindo admin stats) continua
   funcionando sem alteração. Colunas novas guardam o array completo em JSON. Migration manual
   (`.sql` fornecido, nunca aplicado por mim). Código tolera a migration ainda não aplicada.
   Perfis antigos (só valor único) são lidos como array de 1 item.
3. Gerador de rotina cobre as escolhas: com 2 valores de `aim_difficulty`, o treino principal
   inclui os drills dos dois; com 2 valores de `focus_area`/`aim_difficulty`/`specific_weakness`,
   as partidas de mata-mata priorizam os pilares escolhidos (sem nunca repetir foco no mesmo dia).
   Com 1 valor em tudo: saída **idêntica** à atual (golden).
4. Testes: golden atualizados + novos casos (2 focos, 1 foco, perfil legado, migration ausente,
   admin stats).
5. Critérios de aceite mensuráveis + Fora de escopo explícito.

## Fluxo

```
Questionnaire.jsx (frontend)
  perguntas multi (specific_weakness, focus_area, aim_difficulty): usuário marca 1-2 cards,
  clica "Avançar" (botão, substitui o auto-advance atual só nessas 3 perguntas)
  perguntas single (as 4 restantes): inalterado — clique já avança, como hoje
        │
        │ POST /questionnaire
        │ body: { name, specific_weakness: [...], focus_area: [...],
        │         aim_difficulty: [...], experience_level, reflex_level,
        │         movement_quality, daily_time }   (3 campos agora são arrays de 1-2;
        │                                            os outros continuam escalares)
        ▼
api/routes/questionnaire.py: submit_questionnaire()
  normaliza os 3 campos multi (aceita array OU string solta — ver "Compat. de payload")
  → profile[campo] = lista de 1-2 strings não vazias, deduplicada
        │
        ├─→ database.save_questionnaire(user_id, profile)
        │     grava colunas legadas (profile[campo][0]) + colunas *_multi (JSON do array),
        │     tolerando a ausência das colunas novas (ver "Banco")
        │
        ├─→ services.level_service.resolve_action_level(user_id, profile)   (inalterado)
        │
        └─→ services.routine_generator.generate_routine(profile, ...)
              _build_aim_block: usa profile['aim_difficulty'] (lista) para cobrir os 2 focos
              _daily_focus_order: usa profile['focus_area']/['aim_difficulty']/
                ['specific_weakness'] (listas) para priorizar o foco das partidas
              → routine['focus_area'] / ['aim_difficulty'] / ['specific_weakness']
                continuam sendo a PRIMEIRA escolha (routine JSON não muda de forma —
                TrainingRoutine.jsx e o badge/tip continuam lendo escalar, sem alteração)
```

## Banco

### Colunas novas (migration manual, `supabase_migration_v12.sql`)

Mesmo padrão já usado em `supabase_migration.sql` (`ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT
EXISTS`) e em `supabase_migration_v11.sql`:

```sql
-- Migration v12: multi-select (até 2) em specific_weakness/focus_area/aim_difficulty
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new
--
-- As colunas escalares existentes continuam recebendo a primeira escolha (retrocompat
-- total — admin stats e qualquer consulta legada não mudam). Estas 3 colunas novas
-- guardam o array completo (1 ou 2 valores) como texto JSON, ex: '["tracking","flick"]'.

ALTER TABLE IF EXISTS questionnaire_results
  ADD COLUMN IF NOT EXISTS specific_weakness_multi TEXT,
  ADD COLUMN IF NOT EXISTS focus_area_multi        TEXT,
  ADD COLUMN IF NOT EXISTS aim_difficulty_multi    TEXT;
```

Sem RLS (tabela já está com RLS desabilitado — `supabase_schema.sql:59`, mesmo padrão).

### `api/database.py` — tolerância à migration não aplicada

Mesmo padrão de degradação graciosa já usado em `sens_calibrations`
(`api/routes/sensitivity.py`/`api/database.py`, ver `CLAUDE.md` item (c)): o PostgREST rejeita o
`insert()` inteiro se alguma coluna do payload não existir na tabela, então **não dá** para
simplesmente incluir as colunas `*_multi` no mesmo dict sempre — precisa tentar e cair para trás.

```python
def save_questionnaire(user_id: int, data: dict):
    sb = get_supabase()
    row = {
        'user_id':           user_id,
        'focus_area':        _first(data.get('focus_area'), 'aim'),
        'experience_level':  data.get('experience_level', 'iniciante'),
        'aim_difficulty':    _first(data.get('aim_difficulty'), ''),
        'reflex_level':      data.get('reflex_level', ''),
        'movement_quality':  data.get('movement_quality', ''),
        'daily_time':        int(data.get('daily_time', 30)),
        'preferred_tool':    data.get('preferred_tool', 'aimlab'),
        'server_type':       data.get('server_type', ''),
        'main_weapon':       data.get('main_weapon', ''),
        'specific_weakness': _first(data.get('specific_weakness'), ''),
    }
    multi_row = {
        **row,
        'focus_area_multi':        json.dumps(_as_list(data.get('focus_area'), 'aim')),
        'aim_difficulty_multi':    json.dumps(_as_list(data.get('aim_difficulty'), '')),
        'specific_weakness_multi': json.dumps(_as_list(data.get('specific_weakness'), '')),
    }
    try:
        sb.table('questionnaire_results').insert(multi_row).execute()
    except Exception:
        logger.warning('questionnaire_results: colunas *_multi ausentes (migration v12 não '
                        'aplicada ainda) — gravando só as colunas legadas.')
        sb.table('questionnaire_results').insert(row).execute()
```

`_first(value, default)` e `_as_list(value, default)` são os dois únicos pontos que sabem
interpretar "array ou escalar solto" (ver "Compat. de payload" abaixo) — usados também em
`get_latest_questionnaire` na leitura:

```python
def get_latest_questionnaire(user_id: int):
    sb = get_supabase()
    res = (sb.table('questionnaire_results').select('*').eq('user_id', user_id)
             .order('created_at', desc=True).limit(1).execute())
    row = res.data[0] if res.data else None
    if row is None:
        return None
    # Perfil antigo (colunas *_multi ausentes ou NULL) → array de 1 item a partir da
    # coluna legada. Perfil novo → array completo (já em JSON).
    row['focus_area_list']        = _multi_or_legacy(row, 'focus_area_multi', 'focus_area')
    row['aim_difficulty_list']    = _multi_or_legacy(row, 'aim_difficulty_multi', 'aim_difficulty')
    row['specific_weakness_list'] = _multi_or_legacy(row, 'specific_weakness_multi', 'specific_weakness')
    return row
```

### `api/routes/questionnaire.py` — normalização na entrada

```python
def _as_list(value, default):
    if isinstance(value, list):
        items = [str(v).strip() for v in value if str(v).strip()]
    elif value:
        items = [str(value).strip()]
    else:
        items = []
    items = list(dict.fromkeys(items))[:2]   # dedupe, cap em 2 — defesa mesmo com a UI já limitando
    return items or ([default] if default else [])

def _first(value, default):
    items = _as_list(value, default)
    return items[0] if items else default
```

`profile['focus_area']`, `profile['aim_difficulty']`, `profile['specific_weakness']` passam a
ser **listas de 1-2 strings** a partir daqui — `generate_routine` e tudo abaixo dele só lidam com
listas, nunca mais com escalar solto para esses 3 campos (o escalar só existe na borda
DB/legado). As 4 perguntas single continuam escalares, sem `_as_list`.

## Gerador (`api/services/routine_generator.py`)

### Treino principal — cobertura dos 2 focos de mira (`aim_difficulty`)

Só `aim_difficulty` influencia hoje a seleção de drills (`_drill_priority`/
`AIM_DIFFICULTY_EMPHASIS`, linhas 41-49/18-22) — `focus_area` e `specific_weakness` **não**
mudam de comportamento aqui (mesma limitação de hoje, ver "Fora de escopo").

```python
def _primary_aim_difficulty(aim_difficulties: list, today: date) -> str:
    """Com 2 valores, alterna qual é o "principal" (dono do warmup e do reforço extra
    de pontuação) por dia — dia par favorece o índice 0, dia ímpar o índice 1 — pra
    não diluir sempre o mesmo quando o dia é curto (drill_count=2)."""
    if len(aim_difficulties) <= 1:
        return aim_difficulties[0] if aim_difficulties else ''
    return aim_difficulties[today.toordinal() % 2]


def _drill_priority(aim_difficulties: list, reflex_level: str, today: date) -> list:
    scores = {ex: 1 for ex in INTERNAL_EXERCISE_IDS}
    primary = _primary_aim_difficulty(aim_difficulties, today)
    for aim_difficulty in aim_difficulties:
        bump = AIM_DIFFICULTY_EMPHASIS.get(aim_difficulty, {})
        weight = 1 if aim_difficulty == primary else 0.5   # 0.5 só desempata; com 1 valor só, weight é sempre 1 → idêntico a hoje
        for ex, bonus in bump.items():
            scores[ex] = scores.get(ex, 1) + bonus * weight
    for ex, bonus in REFLEX_EMPHASIS.get(reflex_level, {}).items():
        scores[ex] = scores.get(ex, 1) + bonus
    return sorted(INTERNAL_EXERCISE_IDS, key=lambda ex: (-scores[ex], INTERNAL_EXERCISE_IDS.index(ex)))
```

**Garantia de cobertura** (o `_drill_priority` acima já deixa os 2 drills-alvo nas posições mais
altas na prática, mas isso sozinho não é uma *garantia* estrutural se `reflex_level` empurrar um
3º drill pra cima) — `_build_aim_block` reserva explicitamente 1 vaga por valor de
`aim_difficulty` antes de completar o resto por pontuação:

```python
def _build_aim_block(profile: dict, aim_levels: dict, today: date = None):
    today = today or date.today()
    daily_time = int(profile.get('daily_time', 30))
    aim_difficulties = profile.get('aim_difficulty') or ['']
    reflex_level     = profile.get('reflex_level', '')

    priority    = _drill_priority(aim_difficulties, reflex_level, today)
    drill_count = _main_drill_count(daily_time)

    # 1 vaga garantida por foco escolhido (maior pontuação dentre os drills daquele
    # foco específico), na ordem de `priority` — com 1 valor só isso é apenas
    # `priority[:drill_count]`, idêntico a hoje.
    reserved = []
    for aim_difficulty in aim_difficulties:
        target_drills = set(AIM_DIFFICULTY_EMPHASIS.get(aim_difficulty, {}))
        best = next((ex for ex in priority if ex in target_drills and ex not in reserved), None)
        if best:
            reserved.append(best)
    main_ids = reserved + [ex for ex in priority if ex not in reserved]
    main_ids = main_ids[:drill_count]
    rounds   = _rounds_for_budget(daily_time, drill_count)

    top_id = next((ex for ex in priority
                   if ex in AIM_DIFFICULTY_EMPHASIS.get(_primary_aim_difficulty(aim_difficulties, today), {})),
                  priority[0])
    # ... resto (warmup/main dicts) inalterado, usando main_ids/top_id acima
```

Com `aim_difficulty=['tracking','flick']` e `daily_time<=30` (`drill_count=2`): `reserved =
['tracking_suave', 'quick_flick']` (um por foco) → os dois entram, nenhum "dilui" o outro. Com 1
valor só: `reserved` tem no máximo 1 item e o resto vem por pontuação — **byte-idêntico** ao
`_build_aim_block` atual.

### Partidas de mata-mata — priorizar os pilares escolhidos

Hoje `_daily_focus_order(today)` é um shuffle puro (`random.Random(today.isoformat())`),
independente do perfil — **não existe** hoje nenhum mapeamento entre as respostas do
questionário e os 5 `FOCUS_OPTIONS` (`duelos_1x1`, `tracking_combate`, `posicionamento`,
`movement_strafe`, `game_sense`). Este mapeamento é uma decisão nova desta spec — proposta
abaixo, **a confirmar antes da implementação**:

```python
FOCUS_PRIORITY_MAP = {
    ('focus_area', 'aim'):             ['duelos_1x1', 'posicionamento'],
    ('focus_area', 'reflex'):          ['game_sense', 'duelos_1x1'],
    ('focus_area', 'movement'):        ['movement_strafe'],
    ('aim_difficulty', 'tracking'):    ['tracking_combate'],
    ('aim_difficulty', 'flick'):       ['duelos_1x1'],
    ('aim_difficulty', 'close'):       ['duelos_1x1'],
    ('specific_weakness', 'moving_target'): ['tracking_combate'],
    ('specific_weakness', 'headshot'):      ['duelos_1x1'],
    ('specific_weakness', 'long_range'):    ['posicionamento'],
    ('specific_weakness', 'reaction'):      ['game_sense'],
}
```

**Regra de ouro (golden):** com 1 valor em `focus_area`/`aim_difficulty`/`specific_weakness`
(o formato de hoje), a saída tem que ser **idêntica** — então a priorização só entra em ação
quando pelo menos um desses 3 campos tem 2 valores selecionados; caso contrário chama a função
atual sem tocar em nada:

```python
def _daily_focus_order(profile: dict, today: date) -> list:
    fields = [
        ('focus_area', profile.get('focus_area') or []),
        ('aim_difficulty', profile.get('aim_difficulty') or []),
        ('specific_weakness', profile.get('specific_weakness') or []),
    ]
    if all(len(values) <= 1 for _, values in fields):
        return _daily_focus_order_legacy(today)   # = implementação atual, sem alteração nenhuma

    weights = Counter()
    for field, values in fields:
        for value in values:
            for focus_id in FOCUS_PRIORITY_MAP.get((field, value), []):
                weights[focus_id] += 1

    order = _daily_focus_order_legacy(today)   # shuffle determinístico de hoje = desempate
    return sorted(order, key=lambda opt: -weights.get(opt['id'], 0))   # sort estável
```

`_daily_focus_order_legacy` é o `_daily_focus_order` de hoje, renomeado sem nenhuma mudança de
corpo. "Nunca repetir foco no mesmo dia" continua garantido estruturalmente (mesma lista de 5
ids, sem reposição, só reordenada).

### Assinatura de `generate_routine`

`generate_routine(profile, today=None, ...)` já recebe `today` (usado em `_daily_focus_order`)
— só precisa passar `today` adiante pra `_build_aim_block` também (hoje não recebe). Sem mudança
de assinatura pública visível pro chamador (`api/routes/questionnaire.py`).

### `routine['focus_area']` / `['aim_difficulty']` / `['specific_weakness']` no JSON de saída

Continuam **escalares** (primeira escolha) — `TrainingRoutine.jsx` (badge de foco, `sectionTip`,
`FOCUS_TIP_CODES`/`WEAKNESS_TIP_CODES`) não muda uma linha. A cobertura dos 2 focos aparece só
nos `sections[].exercises` (mais de um drill de foco diferente) e no `focus` de cada partida —
não numa nova estrutura de dados que o frontend precisaria aprender a ler.

## UI (`src/frontend/src/components/Questionnaire.jsx`)

- `QUESTIONS` ganha `multiSelect: true` nas 3 entradas (`specific_weakness`, `focus_area`,
  `aim_difficulty`); as outras 4 continuam sem essa flag.
- Perguntas com `multiSelect`: trocar `Radio.Group`/`Radio.Card` por `Checkbox.Group`/
  `Checkbox.Card` (Mantine, mesmo visual — `ThemeIcon` + label/description inalterados),
  `value` vira array (`answers[current.id]` passa a ser `string[]`).
  - Clique num card já selecionado → desmarca (toggle normal do `Checkbox.Group`).
  - Clique num 3º card com 2 já marcados → **não seleciona**; dispara uma classe CSS
    `q-option-card--shake` por ~400ms no card clicado (keyframe simples de translateX,
    adicionada em `index.css`) + um `Text` de hint abaixo do grid: "Máximo 2 seleções" /
    "Maximum 2 selections" (chave nova de locale, ver abaixo).
  - Contador discreto acima do grid: "{{count}}/2 selecionados" / "{{count}}/2 selected".
  - Botão "Avançar" (novo, só nessas 3 perguntas) — desabilitado com 0 seleções, habilitado
    com 1 ou 2. Substitui o auto-advance atual (que dispara no primeiro clique) **só para
    estas 3 perguntas**.
- Perguntas sem `multiSelect` (as 4 restantes): **zero mudança** — `Radio.Group`/`Radio.Card`,
  clique único já avança, exatamente como hoje.
- `handleSelect`/submissão: `answers[current.id]` para as 3 perguntas multi já é array —
  `submitQuestionnaire({ name, ...answers })` passa esses 3 campos como array no payload,
  os outros 4 como escalar (sem mudança).
- Chaves de locale novas (PT/EN, paridade obrigatória — `CLAUDE.md` item (f)):
  `questionario.multiselect_contador` (`"{{count}}/2 selecionados"` / `"{{count}}/2
  selected"`), `questionario.multiselect_maximo` (`"Máximo 2 seleções"` / `"Maximum 2
  selections"`), `questionario.avancar` (`"Avançar"` / `"Next"`).

## Edge cases

| Cenário | Comportamento esperado |
|---|---|
| Usuário marca 1 só nas 3 perguntas multi (não usa a 2ª opção) | Idêntico ao fluxo atual de ponta a ponta — mesma rotina, mesma ordem de partidas (golden). |
| Usuário marca 2 em `aim_difficulty`, 1 nas outras duas | Treino principal cobre os 2 focos de mira; partidas priorizam só pelo que veio de `aim_difficulty` (`focus_area`/`specific_weakness` contribuem 0 peso extra, únicos). |
| Usuário marca 2 em todas as 3 | Pesos de todas as 3 se somam no `FOCUS_PRIORITY_MAP`; empates quebrados pelo shuffle determinístico do dia (como hoje). |
| Tenta marcar uma 3ª opção | Bloqueado na UI (shake + hint); nunca chega a virar array de 3 no payload. Backend também limita a 2 por defesa (`_as_list`, cap `[:2]`) caso um payload malformado chegue por fora da UI. |
| Migration v12 não aplicada ainda, usuário envia 2 escolhas | `save_questionnaire` tenta o insert com as colunas `*_multi`, falha (coluna não existe), loga aviso e regrava só com as colunas legadas (primeira escolha) — sessão gerada normalmente, sem 500. |
| Perfil antigo no banco (colunas `*_multi` NULL ou inexistentes) | `get_latest_questionnaire` devolve `_list` = array de 1 item a partir da coluna legada. `generate_routine` nunca vê uma lista vazia para esses 3 campos. |
| Perfil sem nenhuma resposta ainda (usuário novo, primeira vez) | `_as_list` aplica o mesmo default de hoje (`'aim'` pra `focus_area`, `''` pros outros dois) dentro de uma lista de 1 item — mesmo comportamento inicial de hoje. |
| App desktop desatualizado (versão anterior a esta feature) manda os 3 campos como string solta | `_as_list`/`_first` aceitam string solta transparentemente (vira lista de 1) — sem quebra de contrato de API entre versões de cliente/servidor em skew (`CLAUDE.md` item (c), deploy acontece antes de todo mundo atualizar o app). |
| Admin painel (`GET /admin/stats`) | Continua lendo só a coluna `focus_area` (escalar, primeira escolha) — nenhuma mudança em `get_admin_stats()`/`FOCUS_LABELS`. Distribuição multi-valor não aparece no admin (fora de escopo). |
| `daily_time` curto (`drill_count=2`) + 2 valores de `aim_difficulty` mapeando pro MESMO drill top (ex.: ambos com bônus no `shot_grid`) | `reserved` deduplica (`ex not in reserved`) — a 2ª vaga reservada cai no 2º melhor drill daquele foco, nunca duplica o mesmo id na lista. |

## Critérios de aceite

1. `POST /questionnaire` aceita `focus_area`/`aim_difficulty`/`specific_weakness` como array
   (1-2 itens) ou string solta; resposta sempre `201` nesses casos (sem novo caso de `400`
   introduzido por esta spec).
2. Coluna legada (`focus_area`, `aim_difficulty`, `specific_weakness`) recebe sempre a
   **primeira** posição do array enviado — verificável lendo a linha inserida.
3. Com migration v12 **não aplicada**: `POST /questionnaire` com 2 escolhas continua
   respondendo `201` e gerando rotina; log de aviso emitido; nenhuma coluna `*_multi` gravada
   (óbvio, não existem ainda).
4. Com migration v12 **aplicada**: a mesma chamada grava `focus_area_multi`/
   `aim_difficulty_multi`/`specific_weakness_multi` como JSON do array completo.
5. Perfil legado (linha antiga, sem colunas `*_multi` preenchidas) lido via
   `get_latest_questionnaire` expõe `..._list` como array de 1 item igual à coluna escalar.
6. `generate_routine(profile)` com `aim_difficulty` de 1 item produz **saída byte-idêntica**
   à versão atual do gerador para o mesmo `profile`/`today` (teste golden literal, comparando
   dict a dict).
7. `generate_routine(profile)` com `aim_difficulty=['tracking','flick']` e `daily_time<=30`:
   `tracking_suave` e `quick_flick` aparecem ambos em `sections[1].exercises` (treino
   principal), nenhum repetido.
8. Com `daily_time<=30` e 2 valores de `aim_difficulty`, o drill "principal" (dono do
   warmup) alterna entre os dois valores conforme `today.toordinal() % 2` — verificável
   chamando o gerador com duas datas de paridade diferente e comparando `sections[0]`.
9. `_daily_focus_order`/`generate_routine` com QUALQUER campo (`focus_area`,
   `aim_difficulty`, `specific_weakness`) tendo só 1 valor em todos os 3 produz a MESMA
   ordem de `matches[].focus` que a implementação atual, para o mesmo `today` (teste golden
   literal).
10. Com 2 valores em pelo menos um dos 3 campos: nenhum `matches[].focus` se repete no
    mesmo dia (mesma garantia estrutural de hoje, testável como já é hoje).
11. `GET /admin/stats` não muda de comportamento nem de shape de resposta — mesmo teste de
    hoje continua passando sem alteração no arquivo de teste do admin.
12. UI: ao clicar numa 3ª opção com 2 já marcadas, nenhuma 3ª seleção é registrada em
    `answers` (verificável no state/DOM), classe de shake é aplicada e removida (~400ms) e o
    hint de "máximo 2" fica visível.
13. UI: botão "Avançar" das 3 perguntas multi fica desabilitado com 0 selecionados,
    habilitado com 1 ou 2.
14. Paridade de chaves PT/EN 100% (teste já existente
    `src/frontend/src/locales/*.test.mjs` continua verificando isso — as chaves novas desta
    spec entram nele automaticamente).
15. `npm test` (JS completo + `test:api`) verde antes do release desta feature.

## Fora de escopo

- Migrar/retroativamente preencher as colunas `*_multi` para linhas já existentes no banco —
  ficam `NULL` até o usuário responder o questionário de novo (`CLAUDE.md` item (e) não exige
  migração de dado histórico, só leitura compatível, que já está coberta).
- Mudar as 4 perguntas restantes (`experience_level`, `reflex_level`, `movement_quality`,
  `daily_time`) para multi-select ou qualquer outra alteração nelas.
- Melhorar `GET /admin/stats` para mostrar a distribuição multi-valor (top-2, contagem por
  seleção, etc.) — continua lendo só a coluna escalar de primeira escolha.
- `focus_area`/`specific_weakness` influenciarem a seleção de drills do treino principal —
  hoje só `aim_difficulty`/`reflex_level` fazem isso (`_drill_priority`), e esta spec não
  expande esse acoplamento; `focus_area`/`specific_weakness` só ganham peso na priorização
  das partidas de mata-mata (`FOCUS_PRIORITY_MAP`).
- Qualquer tela de "editar respostas depois" ou refazer só uma pergunta do questionário —
  o fluxo continua sendo o questionário completo do zero.
- Validação forte (400) de valores desconhecidos/fora do catálogo em
  `specific_weakness`/`focus_area`/`aim_difficulty` — mantém o padrão de tolerância que o
  endpoint já tem hoje (nenhum desses 3 campos é validado contra uma allowlist atualmente).
- Qualquer mudança em `sensitivity`/`sens_calibrations` ou no restante do backend não citado
  aqui — escopo é só o questionário + gerador de rotina + as leituras que dependem deles.

## Pontos a confirmar antes da implementação

Sinalizando de acordo com o `CLAUDE.md` (item h) — ambiguidades que resolvi com uma proposta
concreta acima, mas que dependem da sua confirmação antes de eu implementar:

1. **`FOCUS_PRIORITY_MAP`** (mapeamento pilar/dificuldade → foco de partida) é uma tabela nova,
   sem equivalente hoje — a proposta na seção "Gerador" é minha melhor leitura do que faz
   sentido semanticamente, mas é 100% arbitrária e fácil de você querer ajustar.
2. **Peso 0.5 pro foco "secundário" do dia** em `_drill_priority` — existe só pra desempatar
   quando os 2 focos de mira concorrem pelo mesmo slot extra num dia de `drill_count=3`; se
   preferir peso igual (sem desempate por dia) me avisa, é uma linha de mudança.
3. **Botão "Avançar" só nas 3 perguntas multi** (as outras 4 continuam com clique único que já
   avança) — se preferir unificar todas as 7 perguntas num único padrão de UX (com botão em
   todas), é uma decisão de escopo maior que vale alinhar antes.
