import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.goal_generator import (
    DAILY_GOAL_COUNT, ROTATING_CATEGORIES,
    generate_daily_goals, rotating_category_for, adjust_level, level_note_for,
    initial_level_for_experience, _action_target,
    LEVEL_UP_NOTE, LEVEL_DOWN_NOTE,
    KILLS_BY_LEVEL, WINS_BY_LEVEL, POSITIVE_KD_MATCHES_BY_LEVEL, SINGLE_MATCH_KILLS_BY_LEVEL,
    AIM_REPS_BY_LEVEL, MOVEMENT_DUELS_BY_LEVEL, MOVEMENT_PEEK_BY_LEVEL,
    GAME_SENSE_MAX_DEATHS_BY_LEVEL, ANALYSIS_CLIPS_BY_LEVEL,
)

BEGINNER = {'experience_level': 'iniciante',     'preferred_tool': 'aimlab', 'daily_time': 25}
ADVANCED = {'experience_level': 'avancado',      'preferred_tool': 'kovaak', 'daily_time': 70}

SAMPLE_ROUTINE = {
    'tool': 'aimlab',
    'sections': [
        {'name': 'Aquecimento',      'checkable': False, 'exercises': [{'name': 'Gridshot Ultimate'}]},
        {'name': 'Treino Principal', 'checkable': True,  'exercises': [
            {'name': 'Microshot'}, {'name': 'Strafetrack'}, {'name': 'Multilitrack'},
        ]},
        {'name': 'Aplicação em Jogo (Mata-mata)', 'checkable': True, 'exercises': [
            {'name': 'Partida de mata-mata — foco em tracking', 'category': 'in-game'},
        ]},
    ],
}

# Simulates a routine JSON blob persisted before this reform (no 'checkable'
# or 'category' keys, old 'Revisão' section name).
LEGACY_ROUTINE = {
    'tool': 'aimlab',
    'sections': [
        {'name': 'Aquecimento',      'exercises': [{'name': 'Gridshot Ultimate'}]},
        {'name': 'Treino Principal', 'exercises': [{'name': 'Microshot'}]},
        {'name': 'Revisão',          'exercises': []},
    ],
}

EMPTY_ROUTINE = {
    'tool': 'aimlab',
    'sections': [{'exercises': []}, {'exercises': []}, {'exercises': []}],
}


# ── Quantity / shape ──────────────────────────────────────────────────────────

def test_daily_goals_count_and_categories():
    goals = generate_daily_goals(1, BEGINNER, SAMPLE_ROUTINE, '2026-07-06')
    assert len(goals) == DAILY_GOAL_COUNT == 3
    assert goals[0]['category'] == 'aim'
    assert goals[1]['category'] == 'action'
    assert goals[2]['category'] in ROTATING_CATEGORIES
    assert all(g['period'] == 'daily' and g['period_start'] == '2026-07-06' for g in goals)


def test_action_goal_always_present_across_seeds():
    for uid in range(20):
        goals = generate_daily_goals(uid, BEGINNER, SAMPLE_ROUTINE, '2026-07-06')
        assert sum(1 for g in goals if g['category'] == 'action') == 1


def test_daily_goals_fallback_when_routine_has_no_exercises():
    goals = generate_daily_goals(1, BEGINNER, EMPTY_ROUTINE, '2026-07-06')
    assert len(goals) == 3
    assert goals[0]['category'] == 'aim'


def test_daily_goals_without_any_routine():
    goals = generate_daily_goals(1, BEGINNER, None, '2026-07-06')
    assert len(goals) == 3


def test_daily_goal_titles_are_unique():
    goals = generate_daily_goals(3, ADVANCED, SAMPLE_ROUTINE, '2026-07-06')
    titles = [g['title'] for g in goals]
    assert len(titles) == len(set(titles))


# ── Rotating third category ──────────────────────────────────────────────────

def test_rotating_category_for_matches_generated_goal():
    for day in range(1, 10):
        d = date(2026, 7, day)
        goals = generate_daily_goals(1, BEGINNER, SAMPLE_ROUTINE, d.isoformat())
        assert goals[2]['category'] == rotating_category_for(d)


def test_rotating_category_cycles_through_all_three():
    seen = {rotating_category_for(date(2026, 7, d)) for d in range(1, 8)}
    assert seen == set(ROTATING_CATEGORIES)


# ── Action goal integration with routine match count ─────────────────────────

def test_action_target_wins_and_kd_capped_by_routine_match_count():
    assert _action_target('wins', 5, match_count=1) == 1
    assert _action_target('wins', 1, match_count=1) == 1
    assert _action_target('positive_kd_matches', 5, match_count=2) == 2


def test_action_target_kills_not_capped_by_match_count():
    # Kills accumulate across a match regardless of how many matches are
    # played — never bounded by match_count, unlike "partidas" templates.
    assert _action_target('kills_total', 5, match_count=1) == KILLS_BY_LEVEL[5]
    assert _action_target('kills_single_match', 3, match_count=1) == SINGLE_MATCH_KILLS_BY_LEVEL[3]


def test_action_goal_never_asks_more_matches_than_routine_has():
    # SAMPLE_ROUTINE's in-game block has exactly 1 match.
    for uid in range(30):
        goals = generate_daily_goals(uid, BEGINNER, SAMPLE_ROUTINE, '2026-07-06',
                                      levels={'action': 5})
        action = next(g for g in goals if g['category'] == 'action')
        if 'partida' in action['title'] and 'kills' not in action['title']:
            n = int(next(tok for tok in action['title'].split() if tok.isdigit()))
            assert n <= 1


# ── Difficulty scales ─────────────────────────────────────────────────────────

def test_scales_increase_with_level():
    increasing_scales = [
        KILLS_BY_LEVEL, WINS_BY_LEVEL, POSITIVE_KD_MATCHES_BY_LEVEL, SINGLE_MATCH_KILLS_BY_LEVEL,
        AIM_REPS_BY_LEVEL, MOVEMENT_DUELS_BY_LEVEL, MOVEMENT_PEEK_BY_LEVEL, ANALYSIS_CLIPS_BY_LEVEL,
    ]
    for scale in increasing_scales:
        values = [scale[l] for l in range(1, 6)]
        assert values == sorted(values), scale


def test_game_sense_scale_is_inverse_stricter_at_higher_level():
    values = [GAME_SENSE_MAX_DEATHS_BY_LEVEL[l] for l in range(1, 6)]
    assert values == sorted(values, reverse=True)


def test_kills_scale_matches_spec():
    assert KILLS_BY_LEVEL == {1: 40, 2: 70, 3: 110, 4: 160, 5: 220}


def test_wins_scale_matches_spec():
    assert WINS_BY_LEVEL == {1: 1, 2: 2, 3: 3, 4: 4, 5: 5}


# ── Initial level from questionnaire experience ───────────────────────────────

def test_initial_level_for_experience():
    assert initial_level_for_experience('iniciante') == 1
    assert initial_level_for_experience('intermediario') == 2
    assert initial_level_for_experience('avancado') == 3
    assert initial_level_for_experience('not-a-real-level') == 2


def test_default_level_applied_when_no_levels_given():
    goals = generate_daily_goals(1, BEGINNER, SAMPLE_ROUTINE, '2026-07-06')
    assert all(g['level'] == 1 for g in goals)

    goals_adv = generate_daily_goals(1, ADVANCED, SAMPLE_ROUTINE, '2026-07-06')
    assert all(g['level'] == 3 for g in goals_adv)


def test_explicit_levels_and_notes_applied_to_goals():
    rotating = rotating_category_for(date(2026, 7, 6))
    levels = {'aim': 4, 'action': 5, rotating: 2}
    notes  = {'action': LEVEL_UP_NOTE}
    goals  = generate_daily_goals(1, BEGINNER, SAMPLE_ROUTINE, '2026-07-06', levels, notes)
    by_cat = {g['category']: g for g in goals}

    assert by_cat['aim']['level'] == 4
    assert by_cat['aim']['level_note'] == ''
    assert by_cat['action']['level'] == 5
    assert by_cat['action']['level_note'] == LEVEL_UP_NOTE
    assert by_cat[rotating]['level'] == 2


# ── Adaptive difficulty rule (sobe/desce/mantém) ──────────────────────────────

def test_adjust_level_up_after_two_completions():
    assert adjust_level(2, [True, True]) == (3, 'up')


def test_adjust_level_down_after_two_failures():
    assert adjust_level(3, [False, False]) == (2, 'down')


def test_adjust_level_mixed_results_keeps_level():
    assert adjust_level(3, [True, False]) == (3, None)
    assert adjust_level(3, [False, True]) == (3, None)


def test_adjust_level_insufficient_history_keeps_level():
    assert adjust_level(3, []) == (3, None)
    assert adjust_level(3, [True]) == (3, None)


def test_adjust_level_clamped_at_bounds():
    assert adjust_level(5, [True, True]) == (5, None)
    assert adjust_level(1, [False, False]) == (1, None)


def test_adjust_level_ignores_days_beyond_the_last_two():
    # A 3rd, older data point must not affect the up/down decision.
    assert adjust_level(2, [True, True, False]) == (3, 'up')
    assert adjust_level(2, [False, False, True]) == (1, 'down')


def test_level_note_for_matches_change():
    assert level_note_for('up') == LEVEL_UP_NOTE
    assert level_note_for('down') == LEVEL_DOWN_NOTE
    assert level_note_for(None) == ''


# ── Weekly goals removed ──────────────────────────────────────────────────────

def test_weekly_generation_removed_from_module():
    import services.goal_generator as gg
    assert not hasattr(gg, 'generate_weekly_goals')
    assert not hasattr(gg, 'WEEKLY_TEMPLATES')
    assert not hasattr(gg, 'WEEKLY_GOAL_COUNT')


# ── Backward compatibility ────────────────────────────────────────────────────

def test_legacy_server_type_and_routine_shape_do_not_crash():
    profile = dict(BEGINNER, server_type='1v99')
    goals = generate_daily_goals(1, profile, LEGACY_ROUTINE, '2026-07-06')
    assert len(goals) == 3


def test_missing_levels_dict_falls_back_to_experience_default():
    goals = generate_daily_goals(1, BEGINNER, SAMPLE_ROUTINE, '2026-07-06', levels=None, level_notes=None)
    assert len(goals) == 3


# ── Variety across days / determinism within a day ──────────────────────────

def test_daily_goals_vary_across_different_days():
    days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07']
    seen = {tuple(g['title'] for g in generate_daily_goals(1, BEGINNER, SAMPLE_ROUTINE, d)) for d in days}
    assert len(seen) > 1


def test_daily_goals_deterministic_for_same_user_and_day():
    a = generate_daily_goals(7, BEGINNER, SAMPLE_ROUTINE, '2026-07-06')
    b = generate_daily_goals(7, BEGINNER, SAMPLE_ROUTINE, '2026-07-06')
    assert a == b
