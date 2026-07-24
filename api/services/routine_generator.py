import random
from collections import Counter
from datetime import date

from services.level_service import initial_level_for_experience, kill_quota_for_level
from services.aim_level import recommended_difficulty, EXERCISES as INTERNAL_EXERCISE_IDS


def _ensure_list(value):
    """Normalizes specific_weakness/focus_area/aim_difficulty to a list —
    accepts the list shape routes.questionnaire/database.get_latest_questionnaire
    already produce (SPEC-004) as well as a bare scalar (any older/direct
    caller, including existing tests), so both shapes behave identically."""
    if isinstance(value, list):
        return [v for v in value if v]
    return [value] if value else []


def _first_of(value, default):
    """First selection — the routine JSON keeps focus_area/specific_weakness
    scalar (see generate_routine) regardless of how many were chosen."""
    items = _ensure_list(value)
    return items[0] if items else default

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


# SPEC-004: with 2 aim_difficulty values, which one is "today's primary" (gets
# full emphasis weight, owns the warmup drill) alternates by day parity so a
# short day (drill_count=2) doesn't always dilute the same one of the two.
# With 0-1 values this never matters — SECONDARY_WEIGHT only affects a second
# distinct value, so a single-value profile scores byte-identically to before.
SECONDARY_WEIGHT = 0.5


def _primary_aim_difficulty(aim_difficulties: list, today: date) -> str:
    if len(aim_difficulties) <= 1:
        return aim_difficulties[0] if aim_difficulties else ''
    return aim_difficulties[today.toordinal() % 2]


def _drill_priority(aim_difficulties, reflex_level: str, today: date) -> list:
    """The 4 internal exercise ids ordered by how much today's profile
    emphasizes them (highest first); ties keep the catalog's own order.
    `aim_difficulties` may hold 1 or 2 values (SPEC-004) — with 1, this is
    byte-identical to the original single-value behavior."""
    aim_difficulties = _ensure_list(aim_difficulties)
    primary = _primary_aim_difficulty(aim_difficulties, today)
    scores = {ex: 1 for ex in INTERNAL_EXERCISE_IDS}
    for aim_difficulty in aim_difficulties:
        weight = 1 if aim_difficulty == primary else SECONDARY_WEIGHT
        for ex, bonus in AIM_DIFFICULTY_EMPHASIS.get(aim_difficulty, {}).items():
            scores[ex] = scores.get(ex, 1) + bonus * weight
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


def _build_aim_block(profile: dict, aim_levels: dict, today: date = None):
    """Returns (warmup_exercises, main_exercises) — both lists of dicts shaped
    {name, exercise, difficulty, rounds, duration}. `exercise` is the internal
    trainer id (tracking_suave/shot_grid/quick_flick/micro_adjust), used
    directly as the "Treinar" deep-link target. `name` is a routine-wide
    unique key (warmup and main never collide even when they pick the same
    drill) used for progress tracking on the frontend."""
    today      = today or date.today()
    daily_time = int(profile.get('daily_time', 30))
    aim_levels = aim_levels or {}

    aim_difficulties = _ensure_list(profile.get('aim_difficulty'))
    priority    = _drill_priority(aim_difficulties, profile.get('reflex_level', ''), today)
    drill_count = _main_drill_count(daily_time)

    # SPEC-004: reserve 1 slot per distinct aim_difficulty (highest-scoring
    # drill within that focus's own emphasis set) before filling the rest by
    # overall score — a structural guarantee that both chosen foci show up in
    # treino_principal even if reflex_level's bonus would otherwise crowd one
    # out. With 0-1 values this reserves at most 1 slot, which is always
    # already priority[0] — byte-identical to the old `priority[:drill_count]`.
    reserved = []
    for aim_difficulty in aim_difficulties:
        target_drills = set(AIM_DIFFICULTY_EMPHASIS.get(aim_difficulty, {}))
        best = next((ex for ex in priority if ex in target_drills and ex not in reserved), None)
        if best:
            reserved.append(best)
    main_ids = (reserved + [ex for ex in priority if ex not in reserved])[:drill_count]
    rounds   = _rounds_for_budget(daily_time, drill_count)

    primary        = _primary_aim_difficulty(aim_difficulties, today)
    top_id         = next((ex for ex in priority if ex in AIM_DIFFICULTY_EMPHASIS.get(primary, {})), priority[0])
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


def _daily_focus_order_legacy(today: date) -> list:
    rng   = random.Random(today.isoformat())
    order = list(FOCUS_OPTIONS)
    rng.shuffle(order)
    return order


# SPEC-004: maps a questionnaire selection to the mata-mata FOCUS_OPTIONS it
# should prioritize — a brand new mapping (nothing like it existed before
# multi-select), proposed and approved in specs/SPEC-004-questionario-multiselect.md.
FOCUS_PRIORITY_MAP = {
    ('focus_area', 'aim'):                   ['duelos_1x1', 'posicionamento'],
    ('focus_area', 'reflex'):                ['game_sense', 'duelos_1x1'],
    ('focus_area', 'movement'):              ['movement_strafe'],
    ('aim_difficulty', 'tracking'):          ['tracking_combate'],
    ('aim_difficulty', 'flick'):             ['duelos_1x1'],
    ('aim_difficulty', 'close'):             ['duelos_1x1'],
    ('specific_weakness', 'moving_target'):  ['tracking_combate'],
    ('specific_weakness', 'headshot'):       ['duelos_1x1'],
    ('specific_weakness', 'long_range'):     ['posicionamento'],
    ('specific_weakness', 'reaction'):       ['game_sense'],
}


def _daily_focus_order(profile: dict, today: date) -> list:
    """Match focus order for the day. Golden guarantee: with at most 1 value
    in EVERY ONE of focus_area/aim_difficulty/specific_weakness (today's
    shape), this returns exactly _daily_focus_order_legacy(today), untouched
    — the weighted path below only ever runs once multi-select is actually
    used on at least one of the 3 fields."""
    fields = [
        ('focus_area',        _ensure_list(profile.get('focus_area'))),
        ('aim_difficulty',    _ensure_list(profile.get('aim_difficulty'))),
        ('specific_weakness', _ensure_list(profile.get('specific_weakness'))),
    ]
    if all(len(values) <= 1 for _, values in fields):
        return _daily_focus_order_legacy(today)

    weights = Counter()
    for field, values in fields:
        for value in values:
            for focus_id in FOCUS_PRIORITY_MAP.get((field, value), []):
                weights[focus_id] += 1

    order = _daily_focus_order_legacy(today)  # deterministic shuffle = tie-break
    return sorted(order, key=lambda opt: -weights.get(opt['id'], 0))


def generate_routine(profile, today: date = None, action_level: int = None, action_level_note: str = '',
                      aim_accelerated: bool = False, aim_levels: dict = None):
    # focus_area/specific_weakness may now hold up to 2 values (SPEC-004) —
    # the routine JSON keeps these scalar (first choice), same shape the
    # frontend (TrainingRoutine.jsx's badge/tip) already expects.
    focus      = _first_of(profile.get('focus_area'), 'aim')
    experience = profile.get('experience_level', 'iniciante')
    daily_time = int(profile.get('daily_time', 30))
    weapon     = profile.get('main_weapon', '')
    weakness   = _first_of(profile.get('specific_weakness'), '')
    today      = today or date.today()

    warmup, main = _build_aim_block(profile, aim_levels, today)

    match_count = match_count_for_daily_time(daily_time)
    focus_order = _daily_focus_order(profile, today)[:match_count]
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
