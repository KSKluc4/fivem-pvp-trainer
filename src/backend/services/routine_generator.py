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
    'iniciante':    ['beginner'],
    'intermediario': ['beginner', 'intermediate'],
    'avancado':     ['beginner', 'intermediate', 'advanced'],
}

FOCUS_TIPS = {
    'aim':      'Mantenha o crosshair na altura da cabeça. Respire entre cenários e evite tensionar o pulso.',
    'reflex':   'Não force a velocidade — reação natural é mais eficiente que forçada. Consistência primeiro.',
    'movement': 'Strafe e mire ao mesmo tempo — pratique o pre-aim. Movimento imprevisível é a sua armadura.',
}

WEAPON_NOTES = {
    'pistola':  'Pistola: semi-auto preciso supera spray. Cada bala conta — priorize headshots.',
    'rifle':    'Rifle: controle o kick do primeiro tiro. Burst de 2–3 é mais letal que full-auto.',
    'shotgun':  'Shotgun: feche o espaço agressivamente. Mire no centro e ataque sempre primeiro.',
    'misto':    'Múltiplas armas: crosshair placement universal vale para todas — cabeça, sempre.',
}

WEAKNESS_NOTES = {
    'moving_target': 'Inimigos em movimento: mantenha o crosshair à frente do alvo, não sobre ele.',
    'headshot':      'Headshots: ajuste sua sensibilidade — mira mais lenta facilita colocação precisa.',
    'long_range':    'Longa distância: menos sensibilidade + controle de respiração durante o tiro.',
    'reaction':      'Pressão: pré-mire ângulos antes de virar. Quem chega preparado atira primeiro.',
}

SERVER_NOTES = {
    'goat':  'Goat PvP: combates táticos de médio range. Pre-aim de corners é fundamental.',
    '1v99':  '1v99: ritmo frenético, fights curtas. Reflexo e decisão rápida valem mais que precisão.',
    'ambos': 'Múltiplos servidores: treine adaptabilidade — mude a sensibilidade de cenário para cenário.',
    'outro': 'Adapte o treino ao ritmo do seu servidor.',
}


def generate_routine(profile):
    focus      = profile.get('focus_area', 'aim')
    experience = profile.get('experience_level', 'iniciante')
    daily_time = int(profile.get('daily_time', 30))
    tool       = str(profile.get('preferred_tool', 'aimlab')).lower()
    weapon     = profile.get('main_weapon', '')
    server     = profile.get('server_type', '')
    weakness   = profile.get('specific_weakness', '')

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

    # Build contextual tip for the main section
    tip_parts = [FOCUS_TIPS.get(focus, '')]
    if weapon and weapon in WEAPON_NOTES:
        tip_parts.append(WEAPON_NOTES[weapon])
    if weakness and weakness in WEAKNESS_NOTES:
        tip_parts.append(WEAKNESS_NOTES[weakness])
    main_tip = ' | '.join(tip_parts)

    review_tip = 'Anote seu desempenho. O que melhorou? O que ainda trava? Consistência supera intensidade.'
    if server and server in SERVER_NOTES:
        review_tip += f' Dica de servidor: {SERVER_NOTES[server]}'

    return {
        'focus_area':       focus,
        'experience_level': experience,
        'tool':             tool,
        'main_weapon':      weapon,
        'server_type':      server,
        'total_duration':   warmup_time + sum(e['duration'] for e in main) + 5,
        'sections': [
            {
                'name':      'Aquecimento',
                'duration':  warmup_time,
                'exercises': warmup_list,
                'tip':       'Faça cada exercício sem pressão. O objetivo é ativar a musculatura e o reflexo.',
            },
            {
                'name':      'Treino Principal',
                'duration':  sum(e['duration'] for e in main),
                'exercises': main,
                'tip':       main_tip,
            },
            {
                'name':      'Revisão',
                'duration':  5,
                'exercises': [],
                'tip':       review_tip,
            },
        ],
    }
