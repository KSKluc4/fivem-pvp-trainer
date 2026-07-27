"""Per-CATEGORY "aim level" (1-5), derived from the user's trainer_scores.

Single source of truth for the calibration table — recalibrate here only.
Mirrored (same drill ids, same numbers, same formula) on the frontend in
src/frontend/src/trainer/aimLevel.js, which needs its own copy since the
header/dashboard displays run in the browser and can't import Python. Keep
the two in sync when tuning.

── The whole formula, in one place ─────────────────────────────────────────

1. Normalize a single score by its own drill AND difficulty:
       normalized = clamp(score / CALIBRATION[drill][difficulty], 0, 1)
   CALIBRATION holds ONE number per drill per difficulty: the score that
   represents top-tier (level 5) performance in a 60s session.

2. Map it to continuous level points:  points = 1 + 4 * normalized  (1..5)

3. Category level = round(mean(points)) over the newest RECENT_WINDOW scores
   POOLED across all of that category's drills (any drill/difficulty mix —
   each score was already normalized by its own pair). Below MIN_ATTEMPTS
   pooled scores the category level is None ("not enough data yet") —
   callers must exclude None from averages, never treat it as 1.

4. Overall aim level = plain mean of the non-None category levels.

v3.1.0: levels moved from per-drill to per-CATEGORY (the drill library grew
from 4 to 25 — see src/frontend/src/trainer/catalog.js, whose ids/categories
CATEGORY_DRILLS below mirrors). The 4 pre-3.1.0 drills keep their exercise
ids, so existing trainer_scores rows feed the new category levels with no
migration; their calibration values are their old level-5 thresholds.
"""

# Catalog/UI order — also the tie-break order the routine generator uses.
CATEGORIES = ['tracking', 'clicking', 'flicking', 'precision', 'reaction']

# Mirrors trainer/catalog.js (ids + categories only, not gameplay params).
CATEGORY_DRILLS = {
    'tracking':  ['tracking_2d', 'tracking_zigzag_2d', 'tracking_paciente_2d',
                  'tracking_velocista_2d', 'tracking_pare_siga_2d'],
    'clicking':  ['grid_2d', 'clicking_trio_2d', 'clicking_tabuleiro_2d',
                  'clicking_fugaz_2d', 'clicking_alfinete_2d'],
    'flicking':  ['flick_2d', 'flick_longo_2d', 'flick_pendulo_2d',
                  'flick_isca_2d', 'flick_corrente_2d'],
    'precision': ['micro_2d', 'precisao_minguante_2d', 'precisao_mosca_2d',
                  'precisao_salto_2d', 'precisao_fresta_2d'],
    'reaction':  ['reacao_gatilho_2d', 'reacao_dupla_2d', 'reacao_espera_2d',
                  'reacao_rajada_2d', 'reacao_semaforo_2d'],
}

EXERCISES = [drill for drills in CATEGORY_DRILLS.values() for drill in drills]

CATEGORY_OF_EXERCISE = {
    drill: category for category, drills in CATEGORY_DRILLS.items() for drill in drills
}

# Score worth level 5, per drill per difficulty (tracking drills score ms on
# target; everything else scores hits — mosca scores ring points).
#
# v3.3.0: precisao_mosca_2d's medio/dificil lowered alongside a catalog.js
# radius/rings tightening (see src/frontend/src/trainer/difficultyIndex.js —
# that drill had the flattest facil→dificil difficulty progression in the
# catalog). facil is untouched. Scores already recorded under the old,
# easier medio/dificil params aren't flagged as such — there's no
# trainer_scores column for which param version a run used, and adding one
# is a schema migration (CLAUDE.md §2/§5), out of scope here.
CALIBRATION = {
    'tracking_2d':           {'facil': 45000, 'medio': 38000, 'dificil': 30000},
    'tracking_zigzag_2d':    {'facil': 40000, 'medio': 32000, 'dificil': 24000},
    'tracking_paciente_2d':  {'facil': 46000, 'medio': 40000, 'dificil': 33000},
    'tracking_velocista_2d': {'facil': 42000, 'medio': 34000, 'dificil': 26000},
    'tracking_pare_siga_2d': {'facil': 44000, 'medio': 36000, 'dificil': 28000},
    'grid_2d':               {'facil': 55, 'medio': 50, 'dificil': 42},
    'clicking_trio_2d':      {'facil': 60, 'medio': 55, 'dificil': 48},
    'clicking_tabuleiro_2d': {'facil': 58, 'medio': 52, 'dificil': 45},
    'clicking_fugaz_2d':     {'facil': 45, 'medio': 38, 'dificil': 30},
    'clicking_alfinete_2d':  {'facil': 40, 'medio': 34, 'dificil': 27},
    'flick_2d':              {'facil': 42, 'medio': 36, 'dificil': 28},
    'flick_longo_2d':        {'facil': 36, 'medio': 30, 'dificil': 24},
    'flick_pendulo_2d':      {'facil': 40, 'medio': 34, 'dificil': 27},
    'flick_isca_2d':         {'facil': 34, 'medio': 28, 'dificil': 22},
    'flick_corrente_2d':     {'facil': 44, 'medio': 38, 'dificil': 30},
    'micro_2d':              {'facil': 66, 'medio': 54, 'dificil': 42},
    'precisao_minguante_2d': {'facil': 40, 'medio': 34, 'dificil': 26},
    'precisao_mosca_2d':     {'facil': 70, 'medio': 53, 'dificil': 38},
    'precisao_salto_2d':     {'facil': 42, 'medio': 35, 'dificil': 28},
    'precisao_fresta_2d':    {'facil': 38, 'medio': 32, 'dificil': 25},
    'reacao_gatilho_2d':     {'facil': 30, 'medio': 26, 'dificil': 20},
    'reacao_dupla_2d':       {'facil': 40, 'medio': 34, 'dificil': 27},
    'reacao_espera_2d':      {'facil': 30, 'medio': 26, 'dificil': 20},
    'reacao_rajada_2d':      {'facil': 46, 'medio': 40, 'dificil': 32},
    'reacao_semaforo_2d':    {'facil': 26, 'medio': 22, 'dificil': 17},
}

# Below this many recorded attempts (pooled per category), a category's
# level isn't computed at all (None) — also the threshold for a category to
# count toward the overall average.
MIN_ATTEMPTS = 5
RECENT_WINDOW = 15

MIN_LEVEL = 1
MAX_LEVEL = 5

# Maps an aim level to the trainer difficulty the daily-routine "Train
# in-app" recommendation should suggest.
LEVEL_TO_DIFFICULTY = {1: 'facil', 2: 'facil', 3: 'medio', 4: 'dificil', 5: 'dificil'}

# Internal goal_levels category used purely to remember the last-seen
# overall aim tier, so the kill-quota accelerator only fires on a genuine
# NEW increase (see resolve_aim_accelerator) — never shown to the user.
AIM_TIER_TRACKING_CATEGORY = 'aim_tier_tracking'


def level_points_for_score(exercise: str, difficulty: str, score) -> float:
    """Steps 1+2 of the formula: one score -> continuous 1..5 points.
    Unknown drill/difficulty or non-numeric score -> 1.0 (baseline)."""
    ref = CALIBRATION.get(exercise, {}).get(difficulty)
    try:
        score = float(score)
    except (TypeError, ValueError):
        return float(MIN_LEVEL)
    if not ref:
        return float(MIN_LEVEL)
    normalized = min(1.0, max(0.0, score / ref))
    return 1 + 4 * normalized


def category_aim_level(scores: list):
    """Step 3. scores: list of {'exercise', 'difficulty', 'score'} dicts
    pooled for ONE category, newest-first. Only the first RECENT_WINDOW
    entries count. Returns an int 1-5, or None below MIN_ATTEMPTS."""
    window = scores[:RECENT_WINDOW]
    if len(window) < MIN_ATTEMPTS:
        return None
    points = [level_points_for_score(s['exercise'], s['difficulty'], s['score']) for s in window]
    return min(MAX_LEVEL, max(MIN_LEVEL, round(sum(points) / len(points))))


def overall_aim_level(per_category_levels: dict):
    """Step 4. per_category_levels: {category: level_or_None}. Returns the
    average (float) of the non-None levels, or None if none are available."""
    values = [lvl for lvl in per_category_levels.values() if lvl is not None]
    if not values:
        return None
    return sum(values) / len(values)


def recommended_difficulty(aim_level) -> str:
    if aim_level is None:
        return 'medio'
    return LEVEL_TO_DIFFICULTY.get(round(aim_level), 'medio')


def compute_per_category_levels(user_id: int) -> dict:
    """Fetches the user's recent scores ONCE (unfiltered), groups them by
    category and returns {category: level_or_None}. DB-dependent — imported
    lazily so this module (and the pure functions above) stay importable/
    testable without a live Supabase connection."""
    from database import get_trainer_scores

    # One request covering every drill — newest-first globally, so each
    # category's pooled slice is newest-first too. 500 rows comfortably
    # covers 5 categories × RECENT_WINDOW even for heavy daily use.
    rows = get_trainer_scores(user_id, None, limit=500)
    by_category = {category: [] for category in CATEGORIES}
    for row in rows:
        category = CATEGORY_OF_EXERCISE.get(row.get('exercise'))
        if category:
            by_category[category].append(row)
    return {category: category_aim_level(scores) for category, scores in by_category.items()}


def resolve_aim_accelerator(user_id: int, per_category_levels: dict = None) -> bool:
    """Returns True if the user's overall aim level (avg of per-category
    levels, MIN_ATTEMPTS+ scores only) has gone up a whole tier since the
    last time this ran — used to accelerate (not replace) the mata-mata
    kill-quota escalation in services.level_service.

    Always persists the current tier (rounded) so a SUSTAINED higher level
    doesn't keep re-triggering the accelerator on every subsequent day —
    only a fresh increase does. Falls back to False if goal_levels isn't
    migrated yet or there isn't enough trainer data to compute a level.

    per_category_levels can be passed in to reuse an already-computed dict
    (e.g. the same one used for the daily-routine recommendation) instead
    of hitting the DB again.
    """
    from database import get_goal_level, upsert_goal_level

    try:
        levels = per_category_levels if per_category_levels is not None else compute_per_category_levels(user_id)
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
