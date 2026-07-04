import random
from datetime import date

from services.routine_generator import match_count_for_daily_time

DAILY_GOAL_COUNT = 3

CATEGORIES          = ('aim', 'action', 'movement', 'game_sense', 'analysis')
ROTATING_CATEGORIES = ('movement', 'game_sense', 'analysis')

MIN_LEVEL = 1
MAX_LEVEL = 5

# ── Per-category difficulty scales (level 1 → 5) ────────────────────────────
# All calibrated for GOAT-style 15 min deathmatch matches (high kill volume).
KILLS_BY_LEVEL               = {1: 40, 2: 70, 3: 110, 4: 160, 5: 220}
WINS_BY_LEVEL                = {1: 1,  2: 2,  3: 3,   4: 4,   5: 5}
POSITIVE_KD_MATCHES_BY_LEVEL = {1: 1,  2: 1,  3: 2,   4: 2,   5: 3}
SINGLE_MATCH_KILLS_BY_LEVEL  = {1: 15, 2: 25, 3: 35,  4: 45,  5: 60}
AIM_REPS_BY_LEVEL            = {1: 1,  2: 1,  3: 2,   4: 3,   5: 4}
MOVEMENT_DUELS_BY_LEVEL      = {1: 2,  2: 3,  3: 5,   4: 7,   5: 10}
MOVEMENT_PEEK_BY_LEVEL       = {1: 3,  2: 5,  3: 8,   4: 12,  5: 16}
# Inverted scale: higher level = stricter (fewer deaths allowed).
GAME_SENSE_MAX_DEATHS_BY_LEVEL = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
ANALYSIS_CLIPS_BY_LEVEL         = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3}

EXPERIENCE_INITIAL_LEVEL = {
    'iniciante':     1,
    'intermediario': 2,
    'avancado':      3,
}

LEVEL_UP_NOTE   = 'Meta aumentou — você está evoluindo! 📈'
LEVEL_DOWN_NOTE = 'Meta ajustada para retomar o ritmo'

# ── Aim: tied to the day's main exercise ────────────────────────────────────
AIM_TEMPLATES = [
    ('Complete {exercise} com foco total, sem distrações',
     'Presença total no exercício fixa a técnica mais rápido.'),
    ('Faça {reps} rodada(s) de {exercise} tentando superar sua última tentativa',
     'Comparar com você mesmo é o único placar que importa.'),
    ('Repita {exercise} até sentir o movimento natural, sem pressa',
     'Fluidez é o objetivo, não perfeição imediata.'),
]

AIM_FALLBACK_TEMPLATE = (
    'Complete o treino principal do dia no {tool} com foco total, sem distrações',
    'Mesmo curto, um treino focado já fixa técnica.',
)

# ── Action (mata-mata): always present, numeric target scaled by level ─────
# kind marks which scale + whether the target is capped by the day's match
# count (routine never suggests more matches than this asks for).
ACTION_TEMPLATES = [
    ('kills_total', 'Faça {n} kills no mata-mata hoje',
     'Acumule eliminações ao longo das suas partidas do dia.'),
    ('wins', 'Vença {n} partida(s) hoje',
     'Cada vitória é prova de que o treino virou resultado.'),
    ('positive_kd_matches', 'Termine {n} partida(s) com K/D positivo',
     'Mais eliminações do que mortes — meça sua consistência.'),
    ('kills_single_match', 'Faça {n} kills em uma única partida',
     'Um pico de desempenho mostra o teto do seu nível atual.'),
]

# ── Rotating third slot ──────────────────────────────────────────────────────
MOVEMENT_TEMPLATES = [
    ('Vença {n} duelo(s) usando strafe',
     'Movimento lateral consciente confunde a mira do inimigo.', MOVEMENT_DUELS_BY_LEVEL),
    ('Pratique peek esquerdo/direito em {n} duelo(s)',
     'Alternar o lado do peek quebra o padrão que o inimigo espera.', MOVEMENT_PEEK_BY_LEVEL),
]

GAME_SENSE_TEMPLATES = [
    ('Morra no máximo {n} vez(es) por erro de posicionamento em uma partida',
     'No pós-partida, identifique se a morte foi por mira ou por posição.', GAME_SENSE_MAX_DEATHS_BY_LEVEL),
    ('Identifique 1 erro seu e anote',
     'Um erro nomeado é um erro que para de se repetir.', None),
]

ANALYSIS_TEMPLATES = [
    ('Salve {n} clipe(s) de erro ou acerto seu para rever',
     'Rever a própria gameplay acelera o que o treino sozinho não mostra.', ANALYSIS_CLIPS_BY_LEVEL),
]

ROTATING_TEMPLATE_POOL = {
    'movement':   MOVEMENT_TEMPLATES,
    'game_sense': GAME_SENSE_TEMPLATES,
    'analysis':   ANALYSIS_TEMPLATES,
}

# Fallback exercise-goal template used when the routine has no main
# exercises to reference (e.g. a very short daily_time budget).


def initial_level_for_experience(experience_level: str) -> int:
    return EXPERIENCE_INITIAL_LEVEL.get(experience_level, 2)


def _clamp_level(level) -> int:
    try:
        level = int(level)
    except (TypeError, ValueError):
        return 2
    return max(MIN_LEVEL, min(MAX_LEVEL, level))


def adjust_level(current_level: int, recent_results: list):
    """Adaptive difficulty rule, evaluated per category at daily-goal generation.

    recent_results: booleans (completed?) for the last up to 2 prior days this
    category had a goal generated, most-recent first. Days without a goal for
    this category don't count (they're simply absent from the list) — a
    natural fit for the rotating slot, which only shows up every ~3 days.

    Returns (new_level, change) where change is None | 'up' | 'down'.
    """
    current_level = _clamp_level(current_level)
    if len(recent_results) < 2:
        return current_level, None

    last_two = recent_results[:2]
    if all(last_two):
        if current_level >= MAX_LEVEL:
            return current_level, None
        return current_level + 1, 'up'
    if not any(last_two):
        if current_level <= MIN_LEVEL:
            return current_level, None
        return current_level - 1, 'down'
    return current_level, None


def level_note_for(change: str) -> str:
    if change == 'up':
        return LEVEL_UP_NOTE
    if change == 'down':
        return LEVEL_DOWN_NOTE
    return ''


def rotating_category_for(period_start_date: date) -> str:
    idx = period_start_date.toordinal() % len(ROTATING_CATEGORIES)
    return ROTATING_CATEGORIES[idx]


def _seeded_rng(user_id: int, period: str, period_start: str) -> random.Random:
    return random.Random(f'{user_id}:{period}:{period_start}')


def today_period_start(today: date = None) -> str:
    return (today or date.today()).isoformat()


def _tool_label(profile_or_routine: dict) -> str:
    tool = str(profile_or_routine.get('tool') or profile_or_routine.get('preferred_tool') or 'aimlab').lower()
    return "KovaaK's" if tool == 'kovaak' else 'Aim Lab'


def _main_exercise_names(routine: dict) -> list:
    if not routine:
        return []
    sections = routine.get('sections') or []
    main = sections[1] if len(sections) > 1 else {}
    return [e['name'] for e in (main.get('exercises') or []) if e.get('name')]


def _routine_match_count(routine: dict, profile: dict) -> int:
    if routine:
        count = sum(
            1
            for section in (routine.get('sections') or [])
            for ex in (section.get('exercises') or [])
            if ex.get('category') == 'in-game'
        )
        if count:
            return count
    return match_count_for_daily_time(int((profile or {}).get('daily_time', 30)))


def _action_target(kind: str, level: int, match_count: int) -> int:
    if kind == 'kills_total':
        return KILLS_BY_LEVEL[level]
    if kind == 'kills_single_match':
        return SINGLE_MATCH_KILLS_BY_LEVEL[level]
    if kind == 'wins':
        return min(WINS_BY_LEVEL[level], match_count)
    if kind == 'positive_kd_matches':
        return min(POSITIVE_KD_MATCHES_BY_LEVEL[level], match_count)
    raise ValueError(f'unknown action goal kind: {kind}')


def _goal(category: str, title: str, description: str, period_start: str, level: int, level_note: str = '') -> dict:
    return {
        'period':       'daily',
        'category':     category,
        'title':        title,
        'description':  description,
        'period_start': period_start,
        'level':        level,
        'level_note':   level_note or '',
    }


def generate_daily_goals(user_id: int, profile: dict, routine: dict, period_start: str = None,
                          levels: dict = None, level_notes: dict = None) -> list:
    """Returns exactly DAILY_GOAL_COUNT goals: 🎯 aim, ⚔️ action (always), + 1 rotating category."""
    profile      = profile or {}
    period_start = period_start or today_period_start()
    period_date  = date.fromisoformat(period_start)
    tool_label   = _tool_label(routine or profile)
    exercises    = _main_exercise_names(routine)
    match_count  = _routine_match_count(routine, profile)
    rng          = _seeded_rng(user_id, 'daily', period_start)

    default_level = initial_level_for_experience(profile.get('experience_level', ''))
    levels        = levels or {}
    level_notes   = level_notes or {}

    def lvl(category):
        return _clamp_level(levels.get(category, default_level))

    goals = []

    # 1. Aim — tied to today's main exercise
    aim_level = lvl('aim')
    if exercises:
        exercise = rng.choice(exercises)
        title_tpl, desc = rng.choice(AIM_TEMPLATES)
        title = title_tpl.format(exercise=exercise, reps=AIM_REPS_BY_LEVEL[aim_level])
    else:
        title_tpl, desc = AIM_FALLBACK_TEMPLATE
        title = title_tpl.format(tool=tool_label)
    goals.append(_goal('aim', title, desc, period_start, aim_level, level_notes.get('aim')))

    # 2. Action (mata-mata) — always present, capped by the day's match count
    action_level = lvl('action')
    kind, title_tpl, desc = rng.choice(ACTION_TEMPLATES)
    n = _action_target(kind, action_level, match_count)
    title = title_tpl.format(n=n)
    goals.append(_goal('action', title, desc, period_start, action_level, level_notes.get('action')))

    # 3. Rotating: movement / game_sense / analysis
    category = rotating_category_for(period_date)
    cat_level = lvl(category)
    title_tpl, desc, scale = rng.choice(ROTATING_TEMPLATE_POOL[category])
    n = scale[cat_level] if scale else None
    title = title_tpl.format(n=n) if n is not None else title_tpl
    goals.append(_goal(category, title, desc, period_start, cat_level, level_notes.get(category)))

    return goals
