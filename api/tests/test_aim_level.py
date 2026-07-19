import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.aim_level import (
    level_for_single_score, exercise_aim_level, overall_aim_level,
    recommended_difficulty, resolve_aim_accelerator,
    THRESHOLDS_BY_EXERCISE, EXERCISES, MIN_ATTEMPTS, RECENT_WINDOW,
    MIN_LEVEL, MAX_LEVEL, AIM_TIER_TRACKING_CATEGORY,
)


def score_rows(exercise, difficulty, scores):
    return [{'exercise': exercise, 'difficulty': difficulty, 'score': s} for s in scores]


# ── level_for_single_score ────────────────────────────────────────────────────

def test_level_for_single_score_baseline_below_first_threshold():
    assert level_for_single_score('shot_grid', 'medio', 0) == 1
    assert level_for_single_score('shot_grid', 'medio', 19) == 1


def test_level_for_single_score_hits_each_threshold_exactly():
    t = THRESHOLDS_BY_EXERCISE['shot_grid']['medio']
    for level in (2, 3, 4, 5):
        assert level_for_single_score('shot_grid', 'medio', t[level]) == level


def test_level_for_single_score_caps_at_five_above_top_threshold():
    t = THRESHOLDS_BY_EXERCISE['shot_grid']['medio']
    assert level_for_single_score('shot_grid', 'medio', t[5] + 1000) == 5


def test_level_for_single_score_unknown_exercise_or_difficulty_is_baseline():
    assert level_for_single_score('not_a_real_exercise', 'medio', 999999) == MIN_LEVEL
    assert level_for_single_score('shot_grid', 'not_a_real_difficulty', 999999) == MIN_LEVEL


def test_all_four_exercises_have_thresholds_for_all_three_difficulties():
    assert set(EXERCISES) == {'tracking_suave', 'shot_grid', 'quick_flick', 'micro_adjust'}
    for exercise in EXERCISES:
        assert set(THRESHOLDS_BY_EXERCISE[exercise].keys()) == {'facil', 'medio', 'dificil'}
        for difficulty, thresholds in THRESHOLDS_BY_EXERCISE[exercise].items():
            values = [thresholds[l] for l in (2, 3, 4, 5)]
            assert values == sorted(values), f'{exercise}/{difficulty} thresholds must be increasing'


# ── exercise_aim_level ────────────────────────────────────────────────────────

def test_exercise_aim_level_none_below_min_attempts():
    scores = score_rows('shot_grid', 'medio', [50] * (MIN_ATTEMPTS - 1))
    assert exercise_aim_level(scores) is None


def test_exercise_aim_level_computed_at_min_attempts():
    scores = score_rows('shot_grid', 'medio', [50] * MIN_ATTEMPTS)  # well above level-5 threshold (40)
    assert exercise_aim_level(scores) == 5


def test_exercise_aim_level_only_considers_recent_window():
    # 10 recent low scores (level 1) plus older high scores that must be ignored.
    recent = score_rows('shot_grid', 'medio', [5] * RECENT_WINDOW)
    older  = score_rows('shot_grid', 'medio', [999] * 5)
    assert exercise_aim_level(recent + older) == 1


def test_exercise_aim_level_averages_mixed_difficulties():
    # medio score of 50 -> level 5; facil score of 10 -> level 1 (facil L2 threshold is 25).
    scores = (
        score_rows('shot_grid', 'medio', [50] * 3)
        + score_rows('shot_grid', 'facil', [10] * 2)
    )
    # levels: [5,5,5,1,1] -> mean 3.4 -> round -> 3
    assert exercise_aim_level(scores) == 3


# ── overall_aim_level ─────────────────────────────────────────────────────────

def test_overall_aim_level_none_when_nothing_computed():
    assert overall_aim_level({'shot_grid': None, 'quick_flick': None}) is None


def test_overall_aim_level_averages_only_non_none_exercises():
    assert overall_aim_level({'shot_grid': 4, 'quick_flick': None, 'micro_adjust': 2}) == 3.0


# ── recommended_difficulty ────────────────────────────────────────────────────

def test_recommended_difficulty_defaults_to_medio_without_data():
    assert recommended_difficulty(None) == 'medio'


def test_recommended_difficulty_maps_levels_to_tiers():
    assert recommended_difficulty(1) == 'facil'
    assert recommended_difficulty(2) == 'facil'
    assert recommended_difficulty(3) == 'medio'
    assert recommended_difficulty(4) == 'dificil'
    assert recommended_difficulty(5) == 'dificil'


# ── resolve_aim_accelerator ────────────────────────────────────────────────────

@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_without_enough_data(mock_get, mock_upsert):
    result = resolve_aim_accelerator(1, per_exercise_levels={'shot_grid': None})
    assert result is False
    mock_upsert.assert_not_called()


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_on_first_ever_resolution(mock_get, mock_upsert):
    # No prior goal_levels row -> baseline is set to the current tier, no
    # acceleration on this very first computation (nothing to compare against).
    mock_get.return_value = None
    result = resolve_aim_accelerator(1, per_exercise_levels={'shot_grid': 3})
    assert result is False
    mock_upsert.assert_called_once_with(1, AIM_TIER_TRACKING_CATEGORY, 3)


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_true_when_tier_increases(mock_get, mock_upsert):
    mock_get.return_value = {'current_level': 2}
    result = resolve_aim_accelerator(1, per_exercise_levels={'shot_grid': 3})
    assert result is True
    mock_upsert.assert_called_once_with(1, AIM_TIER_TRACKING_CATEGORY, 3)


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_when_tier_sustained_not_increased(mock_get, mock_upsert):
    # Same tier as last time -> no acceleration, and no redundant write.
    mock_get.return_value = {'current_level': 3}
    result = resolve_aim_accelerator(1, per_exercise_levels={'shot_grid': 3})
    assert result is False
    mock_upsert.assert_not_called()


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_when_tier_drops(mock_get, mock_upsert):
    mock_get.return_value = {'current_level': 4}
    result = resolve_aim_accelerator(1, per_exercise_levels={'shot_grid': 3})
    assert result is False
    mock_upsert.assert_called_once_with(1, AIM_TIER_TRACKING_CATEGORY, 3)


@patch('database.get_goal_level')
def test_accelerator_false_when_goal_levels_unavailable(mock_get):
    mock_get.side_effect = Exception('table not migrated')
    result = resolve_aim_accelerator(1, per_exercise_levels={'shot_grid': 3})
    assert result is False
