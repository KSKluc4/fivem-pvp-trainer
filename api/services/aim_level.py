"""Per-exercise "aim level" (1-5), derived from the user's trainer_scores.

Single source of truth for the score thresholds — recalibrate here only.
Mirrored (same exercise ids, same numbers) on the frontend in
src/frontend/src/trainer/aimLevel.js, which needs its own copy since the
header/dashboard displays run in the browser and can't import Python. Keep
the two in sync when tuning thresholds.

Level for a SINGLE score is looked up from that score's own difficulty
thresholds (a score is only meaningful relative to the difficulty it was
played at). A per-exercise level is the rounded average of the per-score
levels across the last RECENT_WINDOW scores (any difficulty mixed in is
fine — each score is judged against its own difficulty first). Below
MIN_ATTEMPTS scores for that exercise, the level is None ("not enough data
yet") rather than defaulting to 1 — callers should treat None as "exclude
from averages", not "worst level".
"""

# Score thresholds: minimum value to reach that level (2-5). Below the
# level-2 threshold is level 1 (baseline, everyone starts there).
#
# tracking_suave: score = milliseconds spent on-target over a 60s session.
TRACKING_SUAVE_THRESHOLDS = {
    'facil':   {2: 15000, 3: 25000, 4: 35000, 5: 45000},
    'medio':   {2: 10000, 3: 18000, 4: 27000, 5: 38000},
    'dificil': {2: 6000,  3: 12000, 4: 20000, 5: 30000},
}
# shot_grid: score = targets hit in 60s (no timeout, waits for the click).
SHOT_GRID_THRESHOLDS = {
    'facil':   {2: 25, 3: 35, 4: 45, 5: 55},
    'medio':   {2: 20, 3: 30, 4: 40, 5: 50},
    'dificil': {2: 15, 3: 24, 4: 33, 5: 42},
}
# quick_flick: score = targets hit in 60s before the 1.2s timeout.
QUICK_FLICK_THRESHOLDS = {
    'facil':   {2: 18, 3: 26, 4: 34, 5: 42},
    'medio':   {2: 14, 3: 21, 4: 28, 5: 36},
    'dificil': {2: 10, 3: 16, 4: 22, 5: 28},
}
# micro_adjust: score = targets hit in 60s within a short (0.55-0.9s) window.
MICRO_ADJUST_THRESHOLDS = {
    'facil':   {2: 30, 3: 42, 4: 54, 5: 66},
    'medio':   {2: 24, 3: 34, 4: 44, 5: 54},
    'dificil': {2: 18, 3: 26, 4: 34, 5: 42},
}

THRESHOLDS_BY_EXERCISE = {
    'tracking_suave': TRACKING_SUAVE_THRESHOLDS,
    'shot_grid':      SHOT_GRID_THRESHOLDS,
    'quick_flick':    QUICK_FLICK_THRESHOLDS,
    'micro_adjust':   MICRO_ADJUST_THRESHOLDS,
}

EXERCISES = list(THRESHOLDS_BY_EXERCISE.keys())

# Below this many recorded attempts, an exercise's level isn't computed at
# all (None) — also the threshold for a per-exercise level to count toward
# the header's overall average.
MIN_ATTEMPTS = 5
RECENT_WINDOW = 10

MIN_LEVEL = 1
MAX_LEVEL = 5

# Maps an aim level to the trainer difficulty the daily-routine "Train
# in-app" recommendation should suggest.
LEVEL_TO_DIFFICULTY = {1: 'facil', 2: 'facil', 3: 'medio', 4: 'dificil', 5: 'dificil'}

# Internal goal_levels category used purely to remember the last-seen
# overall aim tier, so the kill-quota accelerator only fires on a genuine
# NEW increase (see resolve_aim_accelerator) — never shown to the user.
AIM_TIER_TRACKING_CATEGORY = 'aim_tier_tracking'


def level_for_single_score(exercise: str, difficulty: str, score) -> int:
    """1-5. Unknown exercise/difficulty or non-numeric score -> 1 (baseline)."""
    thresholds = THRESHOLDS_BY_EXERCISE.get(exercise, {}).get(difficulty)
    try:
        score = float(score)
    except (TypeError, ValueError):
        return MIN_LEVEL
    if not thresholds:
        return MIN_LEVEL
    level = MIN_LEVEL
    for lvl in (2, 3, 4, 5):
        if score >= thresholds[lvl]:
            level = lvl
    return level


def exercise_aim_level(scores: list):
    """scores: list of {'exercise', 'difficulty', 'score'} dicts for ONE
    exercise, newest-first (matches get_trainer_scores' ordering). Only the
    first RECENT_WINDOW entries are considered. Returns an int 1-5, or None
    if there are fewer than MIN_ATTEMPTS scores."""
    window = scores[:RECENT_WINDOW]
    if len(window) < MIN_ATTEMPTS:
        return None
    levels = [level_for_single_score(s['exercise'], s['difficulty'], s['score']) for s in window]
    return round(sum(levels) / len(levels))


def overall_aim_level(per_exercise_levels: dict):
    """per_exercise_levels: {exercise: level_or_None}. Returns the average
    (float) of the non-None levels, or None if none are available yet."""
    values = [lvl for lvl in per_exercise_levels.values() if lvl is not None]
    if not values:
        return None
    return sum(values) / len(values)


def recommended_difficulty(aim_level) -> str:
    if aim_level is None:
        return 'medio'
    return LEVEL_TO_DIFFICULTY.get(round(aim_level), 'medio')


def compute_per_exercise_levels(user_id: int) -> dict:
    """Fetches the last RECENT_WINDOW scores for each known exercise and
    returns {exercise: level_or_None}. DB-dependent — imported lazily so
    this module (and the pure functions above) stay importable/testable
    without a live Supabase connection."""
    from database import get_trainer_scores

    return {
        exercise: exercise_aim_level(get_trainer_scores(user_id, exercise, limit=RECENT_WINDOW))
        for exercise in EXERCISES
    }


def resolve_aim_accelerator(user_id: int, per_exercise_levels: dict = None) -> bool:
    """Returns True if the user's overall aim level (avg of per-exercise
    levels, MIN_ATTEMPTS+ scores only) has gone up a whole tier since the
    last time this ran — used to accelerate (not replace) the mata-mata
    kill-quota escalation in services.level_service.

    Always persists the current tier (rounded) so a SUSTAINED higher level
    doesn't keep re-triggering the accelerator on every subsequent day —
    only a fresh increase does. Falls back to False if goal_levels isn't
    migrated yet or there isn't enough trainer data to compute a level.

    per_exercise_levels can be passed in to reuse an already-computed dict
    (e.g. the same one used for the daily-routine recommendation) instead
    of hitting the DB again.
    """
    from database import get_goal_level, upsert_goal_level

    try:
        levels = per_exercise_levels if per_exercise_levels is not None else compute_per_exercise_levels(user_id)
        overall = overall_aim_level(levels)
        if overall is None:
            return False
        current_tier = round(overall)
        existing = get_goal_level(user_id, AIM_TIER_TRACKING_CATEGORY)
        previous_tier = existing['current_level'] if existing else current_tier
        if existing is None or current_tier != previous_tier:
            upsert_goal_level(user_id, AIM_TIER_TRACKING_CATEGORY, current_tier)
        return current_tier > previous_tier
    except Exception as e:
        print(f'[aim_level] accelerator unavailable: {e}')
        return False
