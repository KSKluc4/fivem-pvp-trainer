import random
from datetime import date

from services.level_service import initial_level_for_experience, kill_quota_for_level
from services.aim_level import recommended_difficulty, EXERCISES as INTERNAL_EXERCISE_IDS

# ── Aim block: internal trainer drills only ──────────────────────────────────
#
# KovaaK's/Aim Lab are gone — every day's aim training happens with our own
# 4 drills (see src/frontend/src/trainer/scenarios). Which drills make the
# cut, and in what order, comes from the questionnaire's aim_difficulty/
# reflex_level answers; each drill's difficulty comes from the user's own
# per-exercise aim level (services.aim_level), the same system the in-app
# trainer's own recommendation uses.

# Emphasis bonus per questionnaire answer — higher score sorts first and is
# more likely to make the cut when only 2-3 drills fit the time budget.
AIM_DIFFICULTY_EMPHASIS = {
    'tracking': {'tracking_suave': 2},
    'flick':    {'quick_flick': 2, 'shot_grid': 1},
    'close':    {'micro_adjust': 2, 'shot_grid': 1},
}
REFLEX_EMPHASIS = {
    'lento': {'quick_flick': 1},
}

# One difficulty step down from the day's recommended one — used for the
# warmup drill (same drill as the day's top priority, just eased in).
DIFFICULTY_STEP_DOWN = {'facil': 'facil', 'medio': 'facil', 'dificil': 'medio'}

ROUND_SECONDS           = 60  # matches every drill's SESSION_DURATION_S
ROUND_OVERHEAD_SECONDS  = 15  # brief reset/reposition between rounds
SLOT_SECONDS            = ROUND_SECONDS + ROUND_OVERHEAD_SECONDS

WARMUP_ROUNDS         = 1
MIN_MAIN_ROUNDS       = 2
MAX_MAIN_ROUNDS       = 5
MAIN_RESERVE_SECONDS  = 300  # slack reserved off the daily_time budget, same idea as the old "-5 min"


def _drill_priority(aim_difficulty: str, reflex_level: str) -> list:
    """The 4 internal exercise ids ordered by how much today's profile
    emphasizes them (highest first); ties keep the catalog's own order."""
    scores = {ex: 1 for ex in INTERNAL_EXERCISE_IDS}
    for ex, bonus in AIM_DIFFICULTY_EMPHASIS.get(aim_difficulty, {}).items():
        scores[ex] = scores.get(ex, 1) + bonus
    for ex, bonus in REFLEX_EMPHASIS.get(reflex_level, {}).items():
        scores[ex] = scores.get(ex, 1) + bonus
    return sorted(INTERNAL_EXERCISE_IDS, key=lambda ex: (-scores[ex], INTERNAL_EXERCISE_IDS.index(ex)))


def _main_drill_count(daily_time: int) -> int:
    return 2 if daily_time <= 30 else 3


def _rounds_for_budget(daily_time: int, drill_count: int) -> int:
    budget = daily_time * 60 - (WARMUP_ROUNDS * SLOT_SECONDS) - MAIN_RESERVE_SECONDS
    if drill_count <= 0 or budget <= 0:
        return MIN_MAIN_ROUNDS
    rounds = round(budget / drill_count / SLOT_SECONDS)
    return max(MIN_MAIN_ROUNDS, min(MAX_MAIN_ROUNDS, rounds))


def _minutes_for_rounds(rounds: int) -> int:
    return max(1, round(rounds * SLOT_SECONDS / 60))


def _build_aim_block(profile: dict, aim_levels: dict):
    """Returns (warmup_exercises, main_exercises) — both lists of dicts shaped
    {name, exercise, difficulty, rounds, duration}. `exercise` is the internal
    trainer id (tracking_suave/shot_grid/quick_flick/micro_adjust), used
    directly as the "Treinar" deep-link target. `name` is a routine-wide
    unique key (warmup and main never collide even when they pick the same
    drill) used for progress tracking on the frontend."""
    daily_time = int(profile.get('daily_time', 30))
    aim_levels = aim_levels or {}

    priority    = _drill_priority(profile.get('aim_difficulty', ''), profile.get('reflex_level', ''))
    drill_count = _main_drill_count(daily_time)
    main_ids    = priority[:drill_count]
    rounds      = _rounds_for_budget(daily_time, drill_count)

    top_id         = priority[0]
    top_difficulty = recommended_difficulty(aim_levels.get(top_id))
    warmup = [{
        'name':       f'aquecimento_{top_id}',
        'exercise':   top_id,
        'difficulty': DIFFICULTY_STEP_DOWN.get(top_difficulty, 'facil'),
        'rounds':     WARMUP_ROUNDS,
        'duration':   _minutes_for_rounds(WARMUP_ROUNDS),
    }]

    main = [
        {
            'name':       ex_id,
            'exercise':   ex_id,
            'difficulty': recommended_difficulty(aim_levels.get(ex_id)),
            'rounds':     rounds,
            'duration':   _minutes_for_rounds(rounds),
        }
        for ex_id in main_ids
    ]

    return warmup, main


# Valid codes for the Treino Principal tip — the frontend builds the actual
# tip text from routine['focus_area'] / routine['main_weapon'] /
# routine['specific_weakness'], skipping any that aren't one of these (unset
# or a legacy/unrecognized value).
FOCUS_TIP_CODES     = {'aim', 'reflex', 'movement'}
WEAPON_TIP_CODES    = {'pistola', 'rifle', 'shotgun', 'misto'}
WEAKNESS_TIP_CODES  = {'moving_target', 'headshot', 'long_range', 'reaction'}

# ── In-game application block (mata-mata) ───────────────────────────────────
#
# Closes the daily routine with real matches instead of a passive review —
# each match is its own challenge: a kill quota (scaled by the user's
# adaptive level, see services.level_service) and a distinct focus. Untouched
# by the KovaaK's/Aim Lab removal.
MATCH_DURATION = 15

MATCH_COUNT_BY_DAILY_TIME = [
    (30, 1),   # até 30 min/dia → 1 partida
    (60, 2),   # até 60 min/dia → 2 partidas
]
MATCH_COUNT_MAX = 3


def match_count_for_daily_time(daily_time: int) -> int:
    for threshold, count in MATCH_COUNT_BY_DAILY_TIME:
        if daily_time <= threshold:
            return count
    return MATCH_COUNT_MAX


# Each match in the day's in-game block gets its own focus — never the same
# focus twice in one day. The daily order is deterministic (seeded by date)
# so a page refresh doesn't reshuffle an already-generated routine, but two
# different days read differently. Display label/instruction for each id
# live in the frontend locale files under rotina.focos.<id>.
FOCUS_OPTIONS = [
    {'id': 'duelos_1x1'},
    {'id': 'tracking_combate'},
    {'id': 'posicionamento'},
    {'id': 'movement_strafe'},
    {'id': 'game_sense'},
]

# Quota grows slightly across the day's matches — only the 3rd match gets a
# bump, giving a sense of progression within the session (see spec: partida
# 1 = X, partida 2 = X, partida 3 = X+10%).
MATCH_QUOTA_MULTIPLIERS = {2: 1.1}


def _daily_focus_order(today: date) -> list:
    rng   = random.Random(today.isoformat())
    order = list(FOCUS_OPTIONS)
    rng.shuffle(order)
    return order


def generate_routine(profile, today: date = None, action_level: int = None, action_level_note: str = '',
                      aim_accelerated: bool = False, aim_levels: dict = None):
    focus      = profile.get('focus_area', 'aim')
    experience = profile.get('experience_level', 'iniciante')
    daily_time = int(profile.get('daily_time', 30))
    weapon     = profile.get('main_weapon', '')
    weakness   = profile.get('specific_weakness', '')
    today      = today or date.today()

    warmup, main = _build_aim_block(profile, aim_levels)

    match_count = match_count_for_daily_time(daily_time)
    focus_order = _daily_focus_order(today)[:match_count]
    level       = action_level if action_level is not None else initial_level_for_experience(experience)
    base_quota  = kill_quota_for_level(level, accelerated=aim_accelerated)

    matches = []
    for i in range(match_count):
        focus_opt = focus_order[i]
        quota     = round(base_quota * MATCH_QUOTA_MULTIPLIERS.get(i, 1.0))
        matches.append({
            'name':        f'match_{i + 1}',
            'index':       i + 1,
            'duration':    MATCH_DURATION,
            'category':    'in-game',
            'kill_quota':  quota,
            'focus':       focus_opt['id'],
        })

    warmup_time = sum(e['duration'] for e in warmup)
    main_time   = sum(e['duration'] for e in main)

    return {
        'focus_area':          focus,
        'experience_level':    experience,
        'main_weapon':         weapon,
        'specific_weakness':   weakness,
        'total_duration':      warmup_time + main_time + match_count * MATCH_DURATION,
        'sections': [
            {
                'name':      'aquecimento',
                'duration':  warmup_time,
                'exercises': warmup,
                'checkable': False,
                'tip':       '',
            },
            {
                'name':      'treino_principal',
                'duration':  main_time,
                'exercises': main,
                'checkable': True,
                'tip':       '',
            },
            {
                'name':       'aplicacao_jogo',
                'duration':   match_count * MATCH_DURATION,
                'exercises':  matches,
                'checkable':  True,
                'level':      level,
                'level_note': action_level_note or '',
                'tip':        '',
            },
        ],
    }
