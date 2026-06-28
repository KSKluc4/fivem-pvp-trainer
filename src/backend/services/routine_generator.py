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
    'iniciante': ['beginner'],
    'intermediario': ['beginner', 'intermediate'],
    'avancado': ['beginner', 'intermediate', 'advanced'],
}

TIPS = {
    'aim': 'Mantenha o crosshair na altura da cabeça. Respire entre os cenários e evite tensionar o pulso.',
    'reflex': 'Não force a velocidade — reação natural é mais eficiente que forçada. Foque na consistência.',
    'movement': 'Combine o treino com prática real no servidor. Strafe e mire ao mesmo tempo — pratique o pre-aim.',
}


def generate_routine(profile):
    focus = profile.get('focus_area', 'aim')
    experience = profile.get('experience_level', 'iniciante')
    daily_time = int(profile.get('daily_time', 30))
    tool = str(profile.get('preferred_tool', 'aimlab')).lower()

    if tool not in ('kovaak', 'aimlab'):
        tool = 'aimlab'

    allowed = DIFFICULTY_MAP.get(experience, ['beginner', 'intermediate'])
    warmup_list = WARMUP.get(tool, WARMUP['aimlab'])
    warmup_time = sum(e['duration'] for e in warmup_list)

    candidates = [
        e for e in EXERCISES.get(focus, EXERCISES['aim']).get(tool, [])
        if e['difficulty'] in allowed
    ]

    main = []
    budget = daily_time - warmup_time - 5
    for ex in candidates:
        if budget <= 0:
            break
        main.append(ex)
        budget -= ex['duration']

    return {
        'focus_area': focus,
        'experience_level': experience,
        'tool': tool,
        'total_duration': warmup_time + sum(e['duration'] for e in main) + 5,
        'sections': [
            {
                'name': 'Aquecimento',
                'duration': warmup_time,
                'exercises': warmup_list,
                'tip': 'Faça cada exercício sem pressão. O objetivo é ativar a musculatura e o reflexo.',
            },
            {
                'name': 'Treino Principal',
                'duration': sum(e['duration'] for e in main),
                'exercises': main,
                'tip': TIPS.get(focus, ''),
            },
            {
                'name': 'Revisão',
                'duration': 5,
                'exercises': [],
                'tip': 'Anote seu desempenho. O que melhorou? O que ainda trava? Consistência supera intensidade.',
            },
        ],
    }
