import random
from datetime import date

from services.level_service import initial_level_for_experience, kill_quota_for_level

# Exercise catalog. `name` is the scenario's real, third-party name in
# KovaaK's/Aim Lab (never translated). `key` is a stable slug the frontend
# uses to look up the translated description in locales/<lang>/translation.json
# under rotina.exercicios.<key> — this module carries no display prose itself.
EXERCISES = {
    'aim': {
        'kovaak': [
            {'name': 'Smoothbot', 'key': 'smoothbot', 'duration': 5, 'difficulty': 'beginner'},
            {'name': 'popcorn nightmare', 'key': 'popcorn_nightmare', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'Valorant Medium Strafes Goated', 'key': 'valorant_medium_strafes_goated', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'Air Angelic 4', 'key': 'air_angelic_4', 'duration': 5, 'difficulty': 'advanced'},
            {'name': 'Thin Gauntlet', 'key': 'thin_gauntlet', 'duration': 5, 'difficulty': 'advanced'},
        ],
        'aimlab': [
            {'name': 'Gridshot Ultimate', 'key': 'gridshot_ultimate', 'duration': 5, 'difficulty': 'beginner'},
            {'name': 'Microshot', 'key': 'microshot', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'Strafetrack', 'key': 'strafetrack', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'Multilitrack', 'key': 'multilitrack', 'duration': 5, 'difficulty': 'advanced'},
        ],
    },
    'reflex': {
        'kovaak': [
            {'name': 'Tile Frenzy', 'key': 'tile_frenzy', 'duration': 5, 'difficulty': 'beginner'},
            {'name': '1w4ts_Goated', 'key': '1w4ts_goated', 'duration': 5, 'difficulty': 'beginner'},
            {'name': 'Bounce 180', 'key': 'bounce_180', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'psalmsfasttargets', 'key': 'psalmsfasttargets', 'duration': 5, 'difficulty': 'advanced'},
            {'name': 'Revosect', 'key': 'revosect', 'duration': 5, 'difficulty': 'advanced'},
        ],
        'aimlab': [
            {'name': 'Reflexshot', 'key': 'reflexshot', 'duration': 5, 'difficulty': 'beginner'},
            {'name': 'Spidershot', 'key': 'spidershot', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'Motionshot', 'key': 'motionshot', 'duration': 5, 'difficulty': 'advanced'},
        ],
    },
    'movement': {
        'kovaak': [
            {'name': 'Strafing Tiles', 'key': 'strafing_tiles', 'duration': 5, 'difficulty': 'beginner'},
            {'name': 'Movement Redirect', 'key': 'movement_redirect', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'B180 Goated', 'key': 'b180_goated', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'Pasu Voltaic', 'key': 'pasu_voltaic', 'duration': 5, 'difficulty': 'advanced'},
        ],
        'aimlab': [
            {'name': 'Circletrack', 'key': 'circletrack', 'duration': 5, 'difficulty': 'beginner'},
            {'name': 'Strafetrack', 'key': 'strafetrack', 'duration': 5, 'difficulty': 'intermediate'},
            {'name': 'Multilitrack', 'key': 'multilitrack', 'duration': 5, 'difficulty': 'advanced'},
        ],
    },
}

WARMUP = {
    'kovaak': [
        {'name': 'Smoothbot', 'key': 'smoothbot_aquecimento', 'duration': 3, 'difficulty': 'beginner'},
        {'name': 'Tile Frenzy', 'key': 'tile_frenzy_aquecimento', 'duration': 3, 'difficulty': 'beginner'},
    ],
    'aimlab': [
        {'name': 'Gridshot Ultimate', 'key': 'gridshot_ultimate_aquecimento', 'duration': 3, 'difficulty': 'beginner'},
        {'name': 'Reflexshot', 'key': 'reflexshot_aquecimento', 'duration': 3, 'difficulty': 'beginner'},
    ],
}

DIFFICULTY_MAP = {
    'iniciante':     ['beginner'],
    'intermediario': ['beginner', 'intermediate'],
    'avancado':      ['beginner', 'intermediate', 'advanced'],
}

# Valid codes for the Treino Principal tip — the frontend builds the actual
# tip text from routine['focus_area'] / routine['main_weapon'] /
# routine['specific_weakness'], skipping any that aren't one of these (unset
# or a legacy/unrecognized value).
FOCUS_TIP_CODES    = {'aim', 'reflex', 'movement'}
WEAPON_TIP_CODES    = {'pistola', 'rifle', 'shotgun', 'misto'}
WEAKNESS_TIP_CODES  = {'moving_target', 'headshot', 'long_range', 'reaction'}

# ── In-game application block (mata-mata) ───────────────────────────────────
#
# Closes the daily routine with real matches instead of a passive review —
# each match is its own challenge: a kill quota (scaled by the user's
# adaptive level, see services.level_service) and a distinct focus.
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


def generate_routine(profile, today: date = None, action_level: int = None, action_level_note: str = ''):
    focus      = profile.get('focus_area', 'aim')
    experience = profile.get('experience_level', 'iniciante')
    daily_time = int(profile.get('daily_time', 30))
    tool       = str(profile.get('preferred_tool', 'aimlab')).lower()
    weapon     = profile.get('main_weapon', '')
    weakness   = profile.get('specific_weakness', '')
    today      = today or date.today()

    if tool not in ('kovaak', 'aimlab'):
        tool = 'aimlab'

    allowed     = DIFFICULTY_MAP.get(experience, ['beginner', 'intermediate'])
    warmup_list = WARMUP.get(tool, WARMUP['aimlab'])
    warmup_time = sum(e['duration'] for e in warmup_list)

    candidates = [
        e for e in EXERCISES.get(focus, EXERCISES['aim']).get(tool, [])
        if e['difficulty'] in allowed
    ]

    main   = []
    budget = daily_time - warmup_time - 5
    for ex in candidates:
        if budget <= 0:
            break
        main.append(ex)
        budget -= ex['duration']

    match_count = match_count_for_daily_time(daily_time)
    focus_order = _daily_focus_order(today)[:match_count]
    level       = action_level if action_level is not None else initial_level_for_experience(experience)
    base_quota  = kill_quota_for_level(level)

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

    return {
        'focus_area':        focus,
        'experience_level':  experience,
        'tool':              tool,
        'main_weapon':       weapon,
        'specific_weakness': weakness,
        'total_duration':    warmup_time + sum(e['duration'] for e in main) + match_count * MATCH_DURATION,
        'sections': [
            {
                'name':      'aquecimento',
                'duration':  warmup_time,
                'exercises': warmup_list,
                'checkable': False,
                'tip':       '',
            },
            {
                'name':      'treino_principal',
                'duration':  sum(e['duration'] for e in main),
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
