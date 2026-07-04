import random
from datetime import date, timedelta

LEVEL_MAP = {
    'iniciante':     'beginner',
    'intermediario': 'intermediate',
    'avancado':      'advanced',
}

DAILY_GOAL_COUNT  = 3
WEEKLY_GOAL_COUNT = 3

# ── Daily: exercise-based templates ─────────────────────────────────────────
# {exercise} and {tool} are filled from the user's routine of the day.
DAILY_EXERCISE_TEMPLATES = [
    ('Complete {exercise} no {tool}',
     'Um treino completo e sem pressa fixa a técnica.'),
    ('Faça 2 rodadas de {exercise} no {tool}',
     'Repetição é o que transforma consciência em reflexo.'),
    ('Bata seu recorde pessoal em {exercise}',
     'Compare com sua última sessão e busque um pouco mais.'),
    ('Treine {exercise} por 10 minutos sem pausas',
     'Constância vence intensidade isolada.'),
    ('Aqueça com {exercise} antes da sessão principal',
     'Um bom aquecimento evita erros bobos no início.'),
    ('Finalize {exercise} com o máximo de precisão possível',
     'Precisão primeiro, velocidade depois.'),
    ('Repita {exercise} até sentir o movimento natural',
     'Fluidez é o objetivo, não perfeição imediata.'),
    ('Feche o dia revisando {exercise}',
     'Revisar consolida o aprendizado do dia.'),
]

# ── Daily: deathmatch templates, calibrated by experience level ────────────
DAILY_DEATHMATCH_TEMPLATES = [
    ('Jogue {n} partidas de mata-mata',
     'Aplique o que treinou hoje em combate real.',
     {'beginner': 2, 'intermediate': 3, 'advanced': 5}),
    ('Vença {n} duelos em sequência',
     'Consistência em duelos mostra evolução de mira.',
     {'beginner': 2, 'intermediate': 3, 'advanced': 5}),
    ('Treine drops por {n} minutos',
     'Loot rápido tira vantagem de tempo do inimigo.',
     {'beginner': 10, 'intermediate': 15, 'advanced': 20}),
    ('Sobreviva {n} minutos seguidos sem morrer',
     'Posicionamento importa tanto quanto mira.',
     {'beginner': 5, 'intermediate': 8, 'advanced': 12}),
    ('Finalize {n} inimigos no mata-mata',
     'Cada eliminação é uma repetição a mais de mira sob pressão.',
     {'beginner': 5, 'intermediate': 10, 'advanced': 15}),
    ('Jogue mata-mata focando só em headshots por {n} partida(s)',
     'Isolar a mecânica acelera o aprendizado.',
     {'beginner': 1, 'intermediate': 2, 'advanced': 3}),
    ('Pratique posicionamento em {n} partidas de mata-mata',
     'Bom posicionamento evita duelos desnecessários.',
     {'beginner': 2, 'intermediate': 3, 'advanced': 4}),
    ('Encerre o dia com {n} partida(s) no seu servidor',
     'Aplique o treino direto onde você joga de verdade.',
     {'beginner': 1, 'intermediate': 2, 'advanced': 3}),
]

# Fallback exercise-goal templates used when the routine has no main
# exercises to reference (e.g. a very short daily_time budget).
DAILY_EXERCISE_FALLBACK_TEMPLATES = [
    ('Complete o treino principal do dia no {tool}',
     'Mesmo curto, um treino focado já fixa técnica.'),
    ('Faça um aquecimento completo no {tool}',
     'Aquecer bem prepara mira e reflexo para o resto do dia.'),
]

# ── Weekly templates, calibrated by experience level ────────────────────────
# category is 'exercise' or 'deathmatch' — matches the DB CHECK constraint.
WEEKLY_TEMPLATES = [
    ('exercise', 'Complete a rotina diária em {n} dos 7 dias',
     'Frequência é o que constrói o hábito.',
     {'beginner': 3, 'intermediate': 4, 'advanced': 5}),
    ('exercise', 'Treine pelo menos {n} dias esta semana',
     'Mais dias, menos cada sessão precisa ser perfeita.',
     {'beginner': 3, 'intermediate': 4, 'advanced': 6}),
    ('exercise', 'Complete os exercícios principais em {n} sessões',
     'Foque no treino principal, não só no aquecimento.',
     {'beginner': 3, 'intermediate': 4, 'advanced': 5}),
    ('exercise', 'Pratique por {n} minutos acumulados na semana',
     'Tempo de treino consciente supera tempo aleatório.',
     {'beginner': 60, 'intermediate': 100, 'advanced': 150}),
    ('exercise', 'Melhore seu score em um exercício de tracking',
     'Escolha um cenário e busque evolução mensurável.',
     None),
    ('exercise', 'Finalize a semana com pelo menos {n} metas diárias completas',
     'As metas diárias, somadas, constroem a semana.',
     {'beginner': 9, 'intermediate': 12, 'advanced': 15}),
    ('deathmatch', 'Acumule {n} partidas de mata-mata na semana',
     'Aplique o treino em jogo real, repetidamente.',
     {'beginner': 5, 'intermediate': 10, 'advanced': 15}),
    ('deathmatch', 'Vença {n} duelos em sequência ao menos uma vez',
     'Uma boa sequência prova consistência sob pressão.',
     {'beginner': 3, 'intermediate': 5, 'advanced': 8}),
    ('deathmatch', 'Jogue mata-mata em pelo menos {n} dias diferentes',
     'Repetir em dias diferentes fixa o aprendizado.',
     {'beginner': 2, 'intermediate': 3, 'advanced': 4}),
    ('deathmatch', 'Grave sua melhor sequência de eliminações sem morrer',
     'Acompanhe sua evolução comparando com semanas anteriores.',
     None),
    ('deathmatch', 'Finalize {n} inimigos ao longo da semana no mata-mata',
     'Some as eliminações de todas as suas partidas.',
     {'beginner': 15, 'intermediate': 30, 'advanced': 50}),
    ('deathmatch', 'Treine drops em pelo menos {n} partidas na semana',
     'Loot eficiente economiza segundos valiosos em combate.',
     {'beginner': 3, 'intermediate': 5, 'advanced': 8}),
]


def _level(profile: dict) -> str:
    return LEVEL_MAP.get(profile.get('experience_level', ''), 'intermediate')


def _tool_label(profile_or_routine: dict) -> str:
    tool = str(profile_or_routine.get('tool') or profile_or_routine.get('preferred_tool') or 'aimlab').lower()
    return "KovaaK's" if tool == 'kovaak' else 'Aim Lab'


def _seeded_rng(user_id: int, period: str, period_start: str) -> random.Random:
    return random.Random(f'{user_id}:{period}:{period_start}')


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def today_period_start(today: date = None) -> str:
    return (today or date.today()).isoformat()


def week_period_start(today: date = None) -> str:
    return monday_of(today or date.today()).isoformat()


def next_reset_date(today: date = None) -> str:
    d      = today or date.today()
    monday = monday_of(d)
    return (monday + timedelta(days=7)).isoformat()


def _main_exercise_names(routine: dict) -> list:
    if not routine:
        return []
    sections = routine.get('sections') or []
    main = sections[1] if len(sections) > 1 else {}
    return [e['name'] for e in (main.get('exercises') or []) if e.get('name')]


def generate_daily_goals(user_id: int, profile: dict, routine: dict, period_start: str = None) -> list:
    """Returns exactly DAILY_GOAL_COUNT goal dicts: 2 exercise + 1 deathmatch."""
    profile      = profile or {}
    period_start = period_start or today_period_start()
    level        = _level(profile)
    tool_label   = _tool_label(routine or profile)
    exercises    = _main_exercise_names(routine)
    rng          = _seeded_rng(user_id, 'daily', period_start)

    goals = []

    # 2 exercise-based goals
    ex_template_pool = list(DAILY_EXERCISE_TEMPLATES)
    rng.shuffle(ex_template_pool)
    if exercises:
        names = list(exercises)
        rng.shuffle(names)
        # Prefer 2 distinct exercises; if only 1 is available, reuse it with
        # 2 different templates so the goals still read differently.
        picks = (names * 2)[:2]
        for i in range(2):
            title_tpl, desc = ex_template_pool[i % len(ex_template_pool)]
            title = title_tpl.format(exercise=picks[i], tool=tool_label)
            goals.append({
                'period': 'daily', 'category': 'exercise',
                'title': title, 'description': desc, 'period_start': period_start,
            })
    else:
        fallback_pool = list(DAILY_EXERCISE_FALLBACK_TEMPLATES)
        rng.shuffle(fallback_pool)
        for i in range(2):
            title_tpl, desc = fallback_pool[i % len(fallback_pool)]
            title = title_tpl.format(tool=tool_label)
            goals.append({
                'period': 'daily', 'category': 'exercise',
                'title': title, 'description': desc, 'period_start': period_start,
            })

    # 1 deathmatch goal, calibrated by level
    dm_template = rng.choice(DAILY_DEATHMATCH_TEMPLATES)
    title_tpl, desc, n_by_level = dm_template
    n     = n_by_level[level]
    title = title_tpl.format(n=n)
    goals.append({
        'period': 'daily', 'category': 'deathmatch',
        'title': title, 'description': desc, 'period_start': period_start,
    })

    return goals


def generate_weekly_goals(user_id: int, profile: dict, period_start: str = None) -> list:
    """Returns exactly WEEKLY_GOAL_COUNT goal dicts sampled from the weekly pool."""
    profile      = profile or {}
    period_start = period_start or week_period_start()
    level        = _level(profile)
    rng          = _seeded_rng(user_id, 'weekly', period_start)

    picks = rng.sample(WEEKLY_TEMPLATES, WEEKLY_GOAL_COUNT)
    goals = []
    for category, title_tpl, desc, n_by_level in picks:
        n     = n_by_level[level] if n_by_level else None
        title = title_tpl.format(n=n) if n is not None else title_tpl
        goals.append({
            'period': 'weekly', 'category': category,
            'title': title, 'description': desc, 'period_start': period_start,
        })
    return goals
