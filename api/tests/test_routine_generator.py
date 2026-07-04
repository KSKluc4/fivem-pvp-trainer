import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.routine_generator import (
    generate_routine, match_count_for_daily_time, MATCH_DURATION, INGAME_FOCUS_VARIANTS,
)

PROFILE = {
    'focus_area': 'aim', 'experience_level': 'intermediario',
    'daily_time': 45, 'preferred_tool': 'aimlab',
}


# ── Match count scaling ──────────────────────────────────────────────────────

def test_match_count_buckets():
    assert match_count_for_daily_time(15) == 1
    assert match_count_for_daily_time(25) == 1
    assert match_count_for_daily_time(30) == 1
    assert match_count_for_daily_time(31) == 2
    assert match_count_for_daily_time(45) == 2
    assert match_count_for_daily_time(60) == 2
    assert match_count_for_daily_time(61) == 3
    assert match_count_for_daily_time(90) == 3


# ── Sections shape ────────────────────────────────────────────────────────────

def test_routine_has_three_sections_ending_in_ingame_block():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    names = [s['name'] for s in routine['sections']]
    assert names == ['Aquecimento', 'Treino Principal', 'Aplicação em Jogo (Mata-mata)']


def test_no_revisao_or_server_tip_leftovers():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    assert 'server_type' not in routine
    all_tips = ' '.join(s['tip'] for s in routine['sections'])
    assert 'Revisão' not in all_tips
    assert 'Dica de servidor' not in all_tips
    assert all(s['name'] != 'Revisão' for s in routine['sections'])


def test_checkable_flags():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    warmup, main, ingame = routine['sections']
    assert warmup['checkable'] is False
    assert main['checkable'] is True
    assert ingame['checkable'] is True


def test_ingame_section_matches_profile_daily_time():
    for daily_time, expected_count in [(25, 1), (45, 2), (70, 3)]:
        profile = dict(PROFILE, daily_time=daily_time)
        routine = generate_routine(profile, today=date(2026, 7, 6))
        ingame = routine['sections'][-1]
        assert len(ingame['exercises']) == expected_count
        assert ingame['duration'] == expected_count * MATCH_DURATION
        assert all(e['category'] == 'in-game' for e in ingame['exercises'])
        assert all(e['duration'] == MATCH_DURATION for e in ingame['exercises'])


def test_total_duration_includes_ingame_minutes():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    warmup, main, ingame = routine['sections']
    assert routine['total_duration'] == warmup['duration'] + main['duration'] + ingame['duration']


# ── Focus rotation ────────────────────────────────────────────────────────────

def test_ingame_focus_deterministic_for_same_day():
    a = generate_routine(PROFILE, today=date(2026, 7, 6))
    b = generate_routine(PROFILE, today=date(2026, 7, 6))
    assert a['sections'][-1]['exercises'][0]['name'] == b['sections'][-1]['exercises'][0]['name']


def test_ingame_focus_varies_across_days():
    labels = set()
    for day in range(1, 15):
        routine = generate_routine(PROFILE, today=date(2026, 1, day))
        labels.add(routine['sections'][-1]['tip'])
    assert len(labels) > 1


def test_ingame_focus_always_a_known_variant():
    known_labels = {v['label'] for v in INGAME_FOCUS_VARIANTS}
    for day in range(1, 10):
        routine = generate_routine(PROFILE, today=date(2026, 3, day))
        name = routine['sections'][-1]['exercises'][0]['name']
        assert any(label in name for label in known_labels)


# ── Legacy profile fields tolerated ──────────────────────────────────────────

def test_legacy_server_type_field_ignored_without_error():
    profile = dict(PROFILE, server_type='goat')
    routine = generate_routine(profile, today=date(2026, 7, 6))
    assert routine['sections'][-1]['exercises']
