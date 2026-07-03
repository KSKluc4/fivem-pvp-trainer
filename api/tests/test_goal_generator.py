import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.goal_generator import (
    DAILY_GOAL_COUNT, WEEKLY_GOAL_COUNT,
    generate_daily_goals, generate_weekly_goals,
    next_reset_date, week_period_start,
)

BEGINNER = {'experience_level': 'iniciante', 'preferred_tool': 'aimlab', 'server_type': 'goat'}
ADVANCED = {'experience_level': 'avancado',  'preferred_tool': 'kovaak', 'server_type': 'ambos'}

SAMPLE_ROUTINE = {
    'tool': 'aimlab',
    'sections': [
        {'name': 'Aquecimento',      'exercises': [{'name': 'Gridshot Ultimate'}]},
        {'name': 'Treino Principal', 'exercises': [
            {'name': 'Microshot'}, {'name': 'Strafetrack'}, {'name': 'Multilitrack'},
        ]},
        {'name': 'Revisão', 'exercises': []},
    ],
}

EMPTY_ROUTINE = {
    'tool': 'aimlab',
    'sections': [{'exercises': []}, {'exercises': []}, {'exercises': []}],
}


# ── Quantity per period ──────────────────────────────────────────────────────

def test_daily_goals_count_and_category_split():
    goals = generate_daily_goals(1, BEGINNER, SAMPLE_ROUTINE, '2026-07-06')
    assert len(goals) == DAILY_GOAL_COUNT == 3
    categories = [g['category'] for g in goals]
    assert categories.count('exercise')   == 2
    assert categories.count('deathmatch') == 1
    assert all(g['period'] == 'daily' and g['period_start'] == '2026-07-06' for g in goals)


def test_weekly_goals_count():
    goals = generate_weekly_goals(1, BEGINNER, '2026-06-29')
    assert len(goals) == WEEKLY_GOAL_COUNT == 3
    assert all(g['period'] == 'weekly' and g['period_start'] == '2026-06-29' for g in goals)
    assert all(g['category'] in ('exercise', 'deathmatch') for g in goals)


def test_daily_goals_fallback_when_routine_has_no_exercises():
    goals = generate_daily_goals(1, BEGINNER, EMPTY_ROUTINE, '2026-07-06')
    assert len(goals) == 3
    assert sum(1 for g in goals if g['category'] == 'exercise') == 2


def test_daily_goals_without_any_routine():
    goals = generate_daily_goals(1, BEGINNER, None, '2026-07-06')
    assert len(goals) == 3


# ── Uniqueness (matches the DB UNIQUE(user_id, period, period_start, title)) ──

def test_daily_goal_titles_are_unique():
    goals = generate_daily_goals(3, ADVANCED, SAMPLE_ROUTINE, '2026-07-06')
    titles = [g['title'] for g in goals]
    assert len(titles) == len(set(titles))


def test_weekly_goal_titles_are_unique():
    goals = generate_weekly_goals(3, ADVANCED, '2026-06-29')
    titles = [g['title'] for g in goals]
    assert len(titles) == len(set(titles))


# ── Calibration by profile ───────────────────────────────────────────────────

def test_deathmatch_goal_scales_with_experience_level():
    for uid in range(10):
        beginner_goals = generate_daily_goals(uid, BEGINNER, SAMPLE_ROUTINE, '2026-07-06')
        advanced_goals = generate_daily_goals(uid, ADVANCED, SAMPLE_ROUTINE, '2026-07-06')
        dm_beginner = next(g for g in beginner_goals if g['category'] == 'deathmatch')['title']
        dm_advanced = next(g for g in advanced_goals if g['category'] == 'deathmatch')['title']
        # Same seed picks the same template for both levels — only the
        # calibrated number should differ, so the titles must differ.
        assert dm_beginner != dm_advanced


def test_weekly_goals_are_harder_for_advanced_profile():
    def total_numbers(goals):
        return sum(int(n) for g in goals for n in re.findall(r'\d+', g['title']))

    beginner_total = total_numbers(generate_weekly_goals(42, BEGINNER, '2026-06-29'))
    advanced_total = total_numbers(generate_weekly_goals(42, ADVANCED, '2026-06-29'))
    assert advanced_total > beginner_total


def test_unknown_experience_level_defaults_gracefully():
    profile = {'experience_level': 'not-a-real-level'}
    goals = generate_daily_goals(1, profile, SAMPLE_ROUTINE, '2026-07-06')
    assert len(goals) == 3


def test_legacy_server_type_1v99_does_not_crash():
    profile = dict(BEGINNER, server_type='1v99')
    goals = generate_daily_goals(1, profile, SAMPLE_ROUTINE, '2026-07-06')
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


# ── Week boundaries ───────────────────────────────────────────────────────────

def test_week_period_start_and_next_reset_date():
    thursday = date(2026, 7, 2)
    assert week_period_start(thursday) == '2026-06-29'  # Monday of that week
    assert next_reset_date(thursday)   == '2026-07-06'  # following Monday
