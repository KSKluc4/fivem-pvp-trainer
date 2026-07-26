import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.aim_level import (
    level_points_for_score, category_aim_level, overall_aim_level,
    recommended_difficulty, resolve_aim_accelerator,
    CALIBRATION, CATEGORIES, CATEGORY_DRILLS, CATEGORY_OF_EXERCISE, EXERCISES,
    MIN_ATTEMPTS, RECENT_WINDOW, MIN_LEVEL, MAX_LEVEL, AIM_TIER_TRACKING_CATEGORY,
)


def score_rows(exercise, difficulty, scores):
    return [{'exercise': exercise, 'difficulty': difficulty, 'score': s} for s in scores]


# ── Catalog shape ──────────────────────────────────────────────────────────

def test_five_categories_each_with_five_drills():
    assert set(CATEGORIES) == {'tracking', 'clicking', 'flicking', 'precision', 'reaction'}
    for category in CATEGORIES:
        assert len(CATEGORY_DRILLS[category]) == 5


def test_every_drill_has_calibration_for_all_three_difficulties_increasing():
    assert set(CALIBRATION.keys()) == set(EXERCISES)
    for drill, thresholds in CALIBRATION.items():
        assert set(thresholds.keys()) == {'facil', 'medio', 'dificil'}
        assert thresholds['facil'] > thresholds['medio'] > thresholds['dificil'], \
            f'{drill} calibration must decrease facil > medio > dificil'


def test_category_of_exercise_mirrors_category_drills():
    for category, drills in CATEGORY_DRILLS.items():
        for drill in drills:
            assert CATEGORY_OF_EXERCISE[drill] == category


# ── level_points_for_score ────────────────────────────────────────────────

def test_level_points_at_zero_score_is_baseline():
    assert level_points_for_score('grid_2d', 'medio', 0) == MIN_LEVEL


def test_level_points_at_calibration_threshold_is_five():
    ref = CALIBRATION['grid_2d']['medio']
    assert level_points_for_score('grid_2d', 'medio', ref) == MAX_LEVEL


def test_level_points_caps_at_five_above_threshold():
    ref = CALIBRATION['grid_2d']['medio']
    assert level_points_for_score('grid_2d', 'medio', ref * 10) == MAX_LEVEL


def test_level_points_halfway_to_threshold_is_three():
    ref = CALIBRATION['grid_2d']['medio']
    assert level_points_for_score('grid_2d', 'medio', ref / 2) == 3.0


def test_level_points_unknown_exercise_or_difficulty_is_baseline():
    assert level_points_for_score('not_a_real_exercise', 'medio', 999999) == MIN_LEVEL
    assert level_points_for_score('grid_2d', 'not_a_real_difficulty', 999999) == MIN_LEVEL


def test_level_points_non_numeric_score_is_baseline():
    assert level_points_for_score('grid_2d', 'medio', None) == MIN_LEVEL
    assert level_points_for_score('grid_2d', 'medio', 'oops') == MIN_LEVEL


# ── category_aim_level ────────────────────────────────────────────────────

def test_category_aim_level_none_below_min_attempts():
    scores = score_rows('grid_2d', 'medio', [50] * (MIN_ATTEMPTS - 1))
    assert category_aim_level(scores) is None


def test_category_aim_level_computed_at_min_attempts():
    ref = CALIBRATION['grid_2d']['medio']
    scores = score_rows('grid_2d', 'medio', [ref] * MIN_ATTEMPTS)
    assert category_aim_level(scores) == 5


def test_category_aim_level_only_considers_recent_window():
    recent = score_rows('grid_2d', 'medio', [0] * RECENT_WINDOW)
    older  = score_rows('grid_2d', 'medio', [999999] * 5)
    assert category_aim_level(recent + older) == 1


def test_category_aim_level_pools_across_drills_in_the_category():
    # grid_2d and clicking_trio_2d are both 'clicking' — a pooled category
    # score mixes both drills, each judged on its own calibration.
    ref_grid = CALIBRATION['grid_2d']['medio']
    ref_trio = CALIBRATION['clicking_trio_2d']['medio']
    scores = (
        score_rows('grid_2d', 'medio', [ref_grid] * 3)
        + score_rows('clicking_trio_2d', 'medio', [0] * 2)
    )
    # levels: [5,5,5,1,1] -> mean 3.4 -> round -> 3
    assert category_aim_level(scores) == 3


# ── overall_aim_level ─────────────────────────────────────────────────────

def test_overall_aim_level_none_when_nothing_computed():
    assert overall_aim_level({'tracking': None, 'flicking': None}) is None


def test_overall_aim_level_averages_only_non_none_categories():
    assert overall_aim_level({'tracking': 4, 'flicking': None, 'precision': 2}) == 3.0


# ── recommended_difficulty ────────────────────────────────────────────────

def test_recommended_difficulty_defaults_to_medio_without_data():
    assert recommended_difficulty(None) == 'medio'


def test_recommended_difficulty_maps_levels_to_tiers():
    assert recommended_difficulty(1) == 'facil'
    assert recommended_difficulty(2) == 'facil'
    assert recommended_difficulty(3) == 'medio'
    assert recommended_difficulty(4) == 'dificil'
    assert recommended_difficulty(5) == 'dificil'


# ── resolve_aim_accelerator ────────────────────────────────────────────────

@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_without_enough_data(mock_get, mock_upsert):
    result = resolve_aim_accelerator(1, per_category_levels={'tracking': None})
    assert result is False
    mock_upsert.assert_not_called()


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_on_first_ever_resolution(mock_get, mock_upsert):
    # No prior goal_levels row -> baseline is set to the current tier, no
    # acceleration on this very first computation (nothing to compare against).
    mock_get.return_value = None
    result = resolve_aim_accelerator(1, per_category_levels={'tracking': 3})
    assert result is False
    mock_upsert.assert_called_once_with(1, AIM_TIER_TRACKING_CATEGORY, 3)


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_true_when_tier_increases(mock_get, mock_upsert):
    mock_get.return_value = {'current_level': 2}
    result = resolve_aim_accelerator(1, per_category_levels={'tracking': 3})
    assert result is True
    mock_upsert.assert_called_once_with(1, AIM_TIER_TRACKING_CATEGORY, 3)


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_when_tier_sustained_not_increased(mock_get, mock_upsert):
    # Same tier as last time -> no acceleration, and no redundant write.
    mock_get.return_value = {'current_level': 3}
    result = resolve_aim_accelerator(1, per_category_levels={'tracking': 3})
    assert result is False
    mock_upsert.assert_not_called()


@patch('database.upsert_goal_level')
@patch('database.get_goal_level')
def test_accelerator_false_when_tier_drops(mock_get, mock_upsert):
    mock_get.return_value = {'current_level': 4}
    result = resolve_aim_accelerator(1, per_category_levels={'tracking': 3})
    assert result is False
    mock_upsert.assert_called_once_with(1, AIM_TIER_TRACKING_CATEGORY, 3)


@patch('database.get_goal_level')
def test_accelerator_false_when_goal_levels_unavailable(mock_get):
    mock_get.side_effect = Exception('table not migrated')
    result = resolve_aim_accelerator(1, per_category_levels={'tracking': 3})
    assert result is False
