import random
from datetime import date

from services.level_service import initial_level_for_experience, kill_quota_for_level

EXERCISES = {
    'aim': {
        'kovaak': [
            {'name': 'Smoothbot', 'duration': 5, 'description': 'Tracking suave e contínuo', 'difficulty': 'beginner'},
            {'name': 'popcorn nightmare', 'duration': 5, 'description': 'Microajustes e precisão', 'difficulty': 'intermediate'},
            {'name': 'Valorant Medium Strafes Goated', 'duration': 5, 'description': 'Tracking com targets em movimento', 'difficulty': 'intermediate'},
            {'name': 'Air Angelic 4', 'duration': 5, 'description': 'Tracking aéreo avançado', 'difficulty': 'advanced'},
            {'name': 'Thin Gauntlet', 'duration': 5, 'description': 'Precisão em targets pequenos', 'difficulty': 'advanced'},
        ],
        'aimlab': [
            {'name': 'Gridshot Ultimate', 'duration': 5, 'description': 'Mira rápida em múltiplos targets', 'difficulty': 'beginner'},
            {'name': 'Microshot', 'duration': 5, 'description': 'Precisão em alvos pequenos', 'difficulty': 'intermediate'},
            {'name': 'Strafetrack', 'duration': 5, 'description': 'Tracking de targets em movimento lateral', 'difficulty': 'intermediate'},
            {'name': 'Multilitrack', 'duration': 5, 'description': 'Tracking múltiplos simultâneos', 'difficulty': 'advanced'},
        ],
    },
    'reflex': {
        'kovaak': [
            {'name': 'Tile Frenzy', 'duration': 5, 'description': 'Reação rápida a targets aleatórios', 'difficulty': 'beginner'},
            {'name': '1w4ts_Goated', 'duration': 5, 'description': 'Flick shots de curta distância', 'difficulty': 'beginner'},
            {'name': 'Bounce 180', 'duration': 5, 'description': 'Reflexo e rotação de 180°', 'difficulty': 'intermediate'},
            {'name': 'psalmsfasttargets', 'duration': 5, 'description': 'Targets de alta velocidade', 'difficulty': 'advanced'},
            {'name': 'Revosect', 'duration': 5, 'description': 'Flick avançado com precisão', 'difficulty': 'advanced'},
        ],
        'aimlab': [
            {'name': 'Reflexshot', 'duration': 5, 'description': 'Treino de reação pura', 'difficulty': 'beginner'},
            {'name': 'Spidershot', 'duration': 5, 'description': 'Múltiplos targets em reação', 'difficulty': 'intermediate'},
            {'name': 'Motionshot', 'duration': 5, 'description': 'Flick em targets em movimento', 'difficulty': 'advanced'},
        ],
    },
    'movement': {
        'kovaak': [
            {'name': 'Strafing Tiles', 'duration': 5, 'description': 'Mira enquanto executa strafe', 'difficulty': 'beginner'},
            {'name': 'Movement Redirect', 'duration': 5, 'description': 'Redirecionamento de mira com movimento', 'difficulty': 'intermediate'},
            {'name': 'B180 Goated', 'duration': 5, 'description': 'Controle de mira em mudanças de ângulo', 'difficulty': 'intermediate'},
            {'name': 'Pasu Voltaic', 'duration': 5, 'description': 'Flick com strafe simultâneo', 'difficulty': 'advanced'},
        ],
        'aimlab': [
            {'name': 'Circletrack', 'duration': 5, 'description': 'Tracking circular com movimento', 'difficulty': 'beginner'},
            {'name': 'Strafetrack', 'duration': 5, 'description': 'Mira precisa com strafe lateral', 'difficulty': 'intermediate'},
            {'name': 'Multilitrack', 'duration': 5, 'description': 'Múltiplos targets com movimento complexo', 'difficulty': 'advanced'},
        ],
    },
}

WARMUP = {
    'kovaak': [
        {'name': 'Smoothbot', 'duration': 3, 'description': 'Aquecimento de tracking', 'difficulty': 'beginner'},
        {'name': 'Tile Frenzy', 'duration': 3, 'description': 'Aquecimento de reação', 'difficulty': 'beginner'},
    ],
    'aimlab': [
        {'name': 'Gridshot Ultimate', 'duration': 3, 'description': 'Aquecimento geral', 'difficulty': 'beginner'},
        {'name': 'Reflexshot', 'duration': 3, 'description': 'Aquecimento de reflexo', 'difficulty': 'beginner'},
    ],
}

DIFFICULTY_MAP = {
    'iniciante':     ['beginner'],
    'intermediario': ['beginner', 'intermediate'],
    'avancado':      ['beginner', 'intermediate', 'advanced'],
}

FOCUS_TIPS = {
    'aim':      'Mantenha o crosshair na altura da cabeça. Respire entre cenários e evite tensionar o pulso.',
    'reflex':   'Não force a velocidade — reação natural é mais eficiente que forçada. Consistência primeiro.',
    'movement': 'Strafe e mire ao mesmo tempo — pratique o pre-aim. Movimento imprevisível é a sua armadura.',
}

WEAPON_NOTES = {
    'pistola': 'Pistola: semi-auto preciso supera spray. Cada bala conta — priorize headshots.',
    'rifle':   'Rifle: controle o kick do primeiro tiro. Burst de 2–3 é mais letal que full-auto.',
    'shotgun': 'Shotgun: feche o espaço agressivamente. Mire no centro e ataque sempre primeiro.',
    'misto':   'Múltiplas armas: crosshair placement universal vale para todas — cabeça, sempre.',
}

WEAKNESS_NOTES = {
    'moving_target': 'Inimigos em movimento: mantenha o crosshair à frente do alvo, não sobre ele.',
    'headshot':      'Headshots: ajuste sua sensibilidade — mira mais lenta facilita colocação precisa.',
    'long_range':    'Longa distância: menos sensibilidade + controle de respiração durante o tiro.',
    'reaction':      'Pressão: pré-mire ângulos antes de virar. Quem chega preparado atira primeiro.',
}

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
# different days read differently.
FOCUS_OPTIONS = [
    {
        'id':          'duelos_1x1',
        'label':       'duelos 1x1',
        'instruction': 'Busque confrontos diretos 1x1 e feche cada duelo com decisão.',
    },
    {
        'id':          'tracking_combate',
        'label':       'tracking em combate',
        'instruction': 'Mantenha o crosshair no inimigo mesmo quando ele — ou você — está em movimento.',
    },
    {
        'id':          'posicionamento',
        'label':       'posicionamento',
        'instruction': 'Use ângulos e cover para vencer o duelo antes mesmo de atirar.',
    },
    {
        'id':          'movement_strafe',
        'label':       'movement/strafe',
        'instruction': 'Mova-se de forma imprevisível enquanto atira — nunca fique parado.',
    },
    {
        'id':          'game_sense',
        'label':       'game sense',
        'instruction': 'Preste atenção em som e posicionamento do inimigo antes de engajar.',
    },
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

    tip_parts = [FOCUS_TIPS.get(focus, '')]
    if weapon and weapon in WEAPON_NOTES:
        tip_parts.append(WEAPON_NOTES[weapon])
    if weakness and weakness in WEAKNESS_NOTES:
        tip_parts.append(WEAKNESS_NOTES[weakness])
    main_tip = ' | '.join(tip_parts)

    match_count = match_count_for_daily_time(daily_time)
    focus_order = _daily_focus_order(today)[:match_count]
    level       = action_level if action_level is not None else initial_level_for_experience(experience)
    base_quota  = kill_quota_for_level(level)

    matches = []
    for i in range(match_count):
        focus_opt = focus_order[i]
        quota     = round(base_quota * MATCH_QUOTA_MULTIPLIERS.get(i, 1.0))
        matches.append({
            'name':        f'Partida {i + 1} — Mate {quota} inimigos · Foco: {focus_opt["label"]}',
            'duration':    MATCH_DURATION,
            'description': focus_opt['instruction'],
            'category':    'in-game',
            'kill_quota':  quota,
            'focus':       focus_opt['id'],
        })

    return {
        'focus_area':       focus,
        'experience_level': experience,
        'tool':             tool,
        'main_weapon':      weapon,
        'total_duration':   warmup_time + sum(e['duration'] for e in main) + match_count * MATCH_DURATION,
        'sections': [
            {
                'name':      'Aquecimento',
                'duration':  warmup_time,
                'exercises': warmup_list,
                'checkable': False,
                'tip':       'Faça cada exercício sem pressão. O objetivo é ativar a musculatura e o reflexo.',
            },
            {
                'name':      'Treino Principal',
                'duration':  sum(e['duration'] for e in main),
                'exercises': main,
                'checkable': True,
                'tip':       main_tip,
            },
            {
                'name':       'Aplicação em Jogo (Mata-mata)',
                'duration':   match_count * MATCH_DURATION,
                'exercises':  matches,
                'checkable':  True,
                'level':      level,
                'level_note': action_level_note or '',
                'tip':        'Jogue no servidor GOAT — cada partida tem sua própria cota e foco. Bata a cota de cada uma.',
            },
        ],
    }
