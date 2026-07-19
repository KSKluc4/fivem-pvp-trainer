import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.routine_generator import (
    generate_routine, match_count_for_daily_time, MATCH_DURATION, FOCUS_OPTIONS,
)
from services.level_service import KILLS_PER_MATCH_BY_LEVEL

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
    # Sections are returned as machine-stable keys (translated on the
    # frontend via rotina.secoes.<key>) rather than ready-made PT prose.
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    names = [s['name'] for s in routine['sections']]
    assert names == ['aquecimento', 'treino_principal', 'aplicacao_jogo']


def test_no_revisao_or_server_tip_leftovers():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    assert 'server_type' not in routine
    all_tips = ' '.join(s['tip'] for s in routine['sections'])
    assert 'Revisão' not in all_tips
    assert 'Dica de servidor' not in all_tips
    assert all(s['name'] != 'Revisão' for s in routine['sections'])


def test_sections_carry_no_hardcoded_prose():
    # Section tips are built on the frontend from codes (section name, plus
    # routine['focus_area']/['main_weapon']/['specific_weakness'] for the
    # main section) — the backend no longer embeds ready-made PT text.
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    assert all(s['tip'] == '' for s in routine['sections'])
    assert routine['specific_weakness'] == PROFILE.get('specific_weakness', '')


def test_checkable_flags():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    warmup, main, ingame = routine['sections']
    assert warmup['checkable'] is False
    assert main['checkable'] is True
    assert ingame['checkable'] is True


def test_total_duration_includes_ingame_minutes():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6))
    warmup, main, ingame = routine['sections']
    assert routine['total_duration'] == warmup['duration'] + main['duration'] + ingame['duration']


# ── Per-match challenge: quota + focus ────────────────────────────────────────

def test_ingame_matches_scale_with_daily_time():
    for daily_time, expected_count in [(25, 1), (45, 2), (70, 3)]:
        profile = dict(PROFILE, daily_time=daily_time)
        routine = generate_routine(profile, today=date(2026, 7, 6))
        ingame = routine['sections'][-1]
        assert len(ingame['exercises']) == expected_count
        assert ingame['duration'] == expected_count * MATCH_DURATION
        assert all(e['category'] == 'in-game' for e in ingame['exercises'])
        assert all(e['duration'] == MATCH_DURATION for e in ingame['exercises'])


def test_each_match_has_a_kill_quota_and_a_focus():
    # `name` is a stable machine key (e.g. "match_1") used for progress
    # tracking — the display title ("Match 1 — Get 60 kills · Focus: ...")
    # is built on the frontend from `index`, `kill_quota`, and `focus`.
    routine = generate_routine(dict(PROFILE, daily_time=70), today=date(2026, 7, 6), action_level=3)
    for i, ex in enumerate(routine['sections'][-1]['exercises']):
        assert ex['kill_quota'] > 0
        assert ex['focus'] in {opt['id'] for opt in FOCUS_OPTIONS}
        assert ex['name'] == f'match_{i + 1}'
        assert ex['index'] == i + 1


def test_matches_never_repeat_focus_within_the_same_day():
    for day in range(1, 20):
        routine = generate_routine(dict(PROFILE, daily_time=70), today=date(2026, 3, day))
        focuses = [ex['focus'] for ex in routine['sections'][-1]['exercises']]
        assert len(focuses) == len(set(focuses))


def test_third_match_quota_bumped_ten_percent():
    routine = generate_routine(dict(PROFILE, daily_time=70), today=date(2026, 7, 6), action_level=3)
    quotas = [ex['kill_quota'] for ex in routine['sections'][-1]['exercises']]
    base = KILLS_PER_MATCH_BY_LEVEL[3]
    assert quotas[0] == base
    assert quotas[1] == base
    assert quotas[2] == round(base * 1.1)


def test_quota_scales_with_action_level():
    routine_lvl1 = generate_routine(PROFILE, today=date(2026, 7, 6), action_level=1)
    routine_lvl4 = generate_routine(PROFILE, today=date(2026, 7, 6), action_level=4)
    assert routine_lvl1['sections'][-1]['exercises'][0]['kill_quota'] == KILLS_PER_MATCH_BY_LEVEL[1]
    assert routine_lvl4['sections'][-1]['exercises'][0]['kill_quota'] == KILLS_PER_MATCH_BY_LEVEL[4]


def test_action_level_defaults_from_experience_when_not_provided():
    beginner = generate_routine(dict(PROFILE, experience_level='iniciante'), today=date(2026, 7, 6))
    advanced = generate_routine(dict(PROFILE, experience_level='avancado'), today=date(2026, 7, 6))
    assert beginner['sections'][-1]['level'] == 1
    assert advanced['sections'][-1]['level'] == 3
    assert beginner['sections'][-1]['exercises'][0]['kill_quota'] == KILLS_PER_MATCH_BY_LEVEL[1]
    assert advanced['sections'][-1]['exercises'][0]['kill_quota'] == KILLS_PER_MATCH_BY_LEVEL[3]


def test_level_note_passed_through_to_section():
    routine = generate_routine(PROFILE, today=date(2026, 7, 6), action_level=3,
                                action_level_note='Meta aumentou — você está evoluindo! 📈')
    assert routine['sections'][-1]['level_note'] == 'Meta aumentou — você está evoluindo! 📈'

    routine_no_note = generate_routine(PROFILE, today=date(2026, 7, 6), action_level=3)
    assert routine_no_note['sections'][-1]['level_note'] == ''


# ── Determinism / variety ────────────────────────────────────────────────────

def test_match_order_deterministic_for_same_day():
    a = generate_routine(dict(PROFILE, daily_time=70), today=date(2026, 7, 6))
    b = generate_routine(dict(PROFILE, daily_time=70), today=date(2026, 7, 6))
    a_focuses = [ex['focus'] for ex in a['sections'][-1]['exercises']]
    b_focuses = [ex['focus'] for ex in b['sections'][-1]['exercises']]
    assert a_focuses == b_focuses


def test_match_focus_varies_across_days():
    seen = set()
    for day in range(1, 15):
        routine = generate_routine(dict(PROFILE, daily_time=25), today=date(2026, 1, day))
        seen.add(routine['sections'][-1]['exercises'][0]['focus'])
    assert len(seen) > 1


# ── Legacy profile fields tolerated ──────────────────────────────────────────

def test_legacy_server_type_field_ignored_without_error():
    profile = dict(PROFILE, server_type='goat')
    routine = generate_routine(profile, today=date(2026, 7, 6))
    assert routine['sections'][-1]['exercises']
