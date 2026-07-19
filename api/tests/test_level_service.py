import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.level_service import (
    adjust_level, level_note_for, initial_level_for_experience, kill_quota_for_level,
    KILLS_PER_MATCH_BY_LEVEL, MIN_LEVEL, MAX_LEVEL,
)


# ── Initial level from questionnaire experience ───────────────────────────────

def test_initial_level_for_experience():
    assert initial_level_for_experience('iniciante') == 1
    assert initial_level_for_experience('intermediario') == 2
    assert initial_level_for_experience('avancado') == 3
    assert initial_level_for_experience('not-a-real-level') == 2


# ── Kill quota scale ──────────────────────────────────────────────────────────

def test_kill_quota_scale_matches_spec():
    assert KILLS_PER_MATCH_BY_LEVEL == {1: 40, 2: 60, 3: 80, 4: 100, 5: 130}


def test_kill_quota_increases_with_level():
    values = [kill_quota_for_level(l) for l in range(1, 6)]
    assert values == sorted(values)
    assert len(set(values)) == 5


def test_kill_quota_clamps_out_of_range_levels():
    assert kill_quota_for_level(0) == KILLS_PER_MATCH_BY_LEVEL[1]
    assert kill_quota_for_level(9) == KILLS_PER_MATCH_BY_LEVEL[5]


# ── Aim accelerator: half-step quota bump, never a substitute for adjust_level ──

def test_accelerated_quota_is_unchanged_by_default():
    for level in range(1, 6):
        assert kill_quota_for_level(level, accelerated=False) == kill_quota_for_level(level)


def test_accelerated_quota_is_halfway_to_next_level():
    # level 2 = 60, level 3 = 80 -> accelerated level 2 = 70 (halfway)
    assert kill_quota_for_level(2, accelerated=True) == 70
    # level 3 = 80, level 4 = 100 -> accelerated level 3 = 90
    assert kill_quota_for_level(3, accelerated=True) == 90


def test_accelerated_quota_at_max_level_has_no_next_step():
    assert kill_quota_for_level(MAX_LEVEL, accelerated=True) == KILLS_PER_MATCH_BY_LEVEL[MAX_LEVEL]


def test_accelerated_quota_always_strictly_between_level_and_next():
    for level in range(1, MAX_LEVEL):
        base = KILLS_PER_MATCH_BY_LEVEL[level]
        nxt  = KILLS_PER_MATCH_BY_LEVEL[level + 1]
        accelerated = kill_quota_for_level(level, accelerated=True)
        assert base < accelerated < nxt


# ── Adaptive difficulty rule (sobe/desce/mantém), now evaluated on matches ───

def test_adjust_level_up_after_two_completed_days():
    assert adjust_level(2, [True, True]) == (3, 'up')


def test_adjust_level_down_after_two_failed_days():
    assert adjust_level(3, [False, False]) == (2, 'down')


def test_adjust_level_mixed_keeps_level():
    assert adjust_level(3, [True, False]) == (3, None)
    assert adjust_level(3, [False, True]) == (3, None)


def test_adjust_level_insufficient_history_keeps_level():
    assert adjust_level(3, []) == (3, None)
    assert adjust_level(3, [True]) == (3, None)


def test_adjust_level_clamped_at_bounds():
    assert adjust_level(MAX_LEVEL, [True, True]) == (MAX_LEVEL, None)
    assert adjust_level(MIN_LEVEL, [False, False]) == (MIN_LEVEL, None)


def test_adjust_level_ignores_days_beyond_the_last_two():
    assert adjust_level(2, [True, True, False]) == (3, 'up')
    assert adjust_level(2, [False, False, True]) == (1, 'down')


def test_level_note_for_matches_change():
    # level_note_for returns the raw 'up'/'down' code — the frontend
    # translates it via rotina.level_note.<code> in the locale files.
    assert level_note_for('up') == 'up'
    assert level_note_for('down') == 'down'
    assert level_note_for(None) == ''
