import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.routine_generator import (
    generate_routine, _daily_focus_order, _daily_focus_order_legacy,
)

# SPEC-004 — multi-select (up to 2) on focus_area/aim_difficulty/specific_weakness.
# The existing api/tests/test_routine_generator.py is untouched on purpose: every
# one of its scenarios uses a single (scalar) value per field, and this file's
# whole point is proving that shape still produces byte-identical output.

PROFILE = {
    'focus_area': 'aim', 'experience_level': 'intermediario',
    'daily_time': 45, 'aim_difficulty': 'tracking', 'reflex_level': 'medio',
}


# ── Golden: 1 value (scalar or 1-item list) == today's exact output ─────────

def test_scalar_and_single_item_list_aim_difficulty_produce_byte_identical_routines():
    scalar_routine = generate_routine(dict(PROFILE, aim_difficulty='tracking'), today=date(2026, 7, 6))
    list_routine   = generate_routine(dict(PROFILE, aim_difficulty=['tracking']), today=date(2026, 7, 6))
    assert scalar_routine == list_routine


def test_scalar_and_single_item_list_focus_fields_produce_byte_identical_routines():
    profile_scalar = dict(PROFILE, focus_area='reflex', specific_weakness='headshot')
    profile_list   = dict(PROFILE, focus_area=['reflex'], specific_weakness=['headshot'])
    for daily_time in (25, 45, 70):
        for day in range(1, 8):
            a = generate_routine(dict(profile_scalar, daily_time=daily_time), today=date(2026, 3, day))
            b = generate_routine(dict(profile_list, daily_time=daily_time), today=date(2026, 3, day))
            assert a == b


def test_daily_focus_order_with_all_single_values_matches_legacy_exactly():
    for day in range(1, 20):
        today = date(2026, 5, day)
        assert _daily_focus_order(PROFILE, today) == _daily_focus_order_legacy(today)


# ── Treino principal covers both aim_difficulty choices ─────────────────────

def test_two_aim_difficulty_values_both_covered_in_main_on_a_short_day():
    profile = dict(PROFILE, aim_difficulty=['tracking', 'flick'], daily_time=25)  # drill_count == 2
    routine = generate_routine(profile, today=date(2026, 7, 6))
    main_ids = [ex['exercise'] for ex in routine['sections'][1]['exercises']]
    assert 'tracking_suave' in main_ids
    assert 'quick_flick' in main_ids
    assert len(main_ids) == len(set(main_ids))  # never duplicated


def test_two_aim_difficulty_values_both_covered_on_a_long_day_too():
    profile = dict(PROFILE, aim_difficulty=['close', 'flick'], daily_time=70)  # drill_count == 3
    routine = generate_routine(profile, today=date(2026, 7, 6))
    main_ids = [ex['exercise'] for ex in routine['sections'][1]['exercises']]
    assert 'micro_adjust' in main_ids
    assert 'quick_flick' in main_ids


def test_primary_aim_difficulty_alternates_by_day_parity():
    profile  = dict(PROFILE, aim_difficulty=['tracking', 'flick'], daily_time=25)
    day_a    = date(2026, 7, 6)
    day_b    = date(2026, 7, 7)
    assert day_a.toordinal() % 2 != day_b.toordinal() % 2  # consecutive days always differ in parity

    routine_a = generate_routine(profile, today=day_a)
    routine_b = generate_routine(profile, today=day_b)
    warmup_a = routine_a['sections'][0]['exercises'][0]['exercise']
    warmup_b = routine_b['sections'][0]['exercises'][0]['exercise']

    assert {warmup_a, warmup_b} == {'tracking_suave', 'quick_flick'}
    assert warmup_a != warmup_b


def test_routine_json_keeps_focus_area_and_specific_weakness_scalar():
    profile = dict(PROFILE, focus_area=['aim', 'reflex'], specific_weakness=['headshot', 'reaction'])
    routine = generate_routine(profile, today=date(2026, 7, 6))
    assert routine['focus_area'] == 'aim'
    assert routine['specific_weakness'] == 'headshot'


# ── Mata-mata match focus prioritizes the chosen pillars ────────────────────

def test_two_values_anywhere_prioritizes_mapped_match_focuses_over_unmapped_ones():
    # aim_difficulty=tracking -> tracking_combate; the 2nd value (flick) is
    # what actually triggers the weighted path (see FOCUS_PRIORITY_MAP).
    profile = dict(PROFILE, aim_difficulty=['tracking', 'flick'], daily_time=70)  # match_count == 3
    routine = generate_routine(profile, today=date(2026, 1, 3))
    focuses = [ex['focus'] for ex in routine['sections'][-1]['exercises']]
    # tracking_combate (tracking) and duelos_1x1 (flick) both get weight >= 1;
    # game_sense/posicionamento/movement_strafe get 0 — so the two mapped
    # ones must be picked before an unmapped one is forced in by match_count.
    assert set(focuses) >= {'tracking_combate', 'duelos_1x1'}


def test_weighted_match_focus_never_repeats_within_the_same_day():
    profile = dict(PROFILE, focus_area=['aim', 'movement'],
                   aim_difficulty=['tracking', 'flick'],
                   specific_weakness=['headshot', 'reaction'], daily_time=70)
    for day in range(1, 15):
        routine = generate_routine(profile, today=date(2026, 2, day))
        focuses = [ex['focus'] for ex in routine['sections'][-1]['exercises']]
        assert len(focuses) == len(set(focuses))


def test_weighted_match_focus_order_deterministic_for_the_same_day():
    profile = dict(PROFILE, aim_difficulty=['tracking', 'flick'], daily_time=70)
    a = generate_routine(profile, today=date(2026, 4, 10))
    b = generate_routine(profile, today=date(2026, 4, 10))
    assert [e['focus'] for e in a['sections'][-1]['exercises']] == [e['focus'] for e in b['sections'][-1]['exercises']]


def test_daily_focus_order_gating_only_activates_with_a_real_2nd_selection():
    # A field present as a 1-item list (e.g. someone who could pick 2 but
    # picked only 1) must NOT trigger the weighted path either.
    profile = dict(PROFILE, focus_area=['aim'], aim_difficulty=['tracking'], specific_weakness=['headshot'])
    for day in range(1, 10):
        today = date(2026, 6, day)
        assert _daily_focus_order(profile, today) == _daily_focus_order_legacy(today)
