"""Adaptive difficulty for the mata-mata (in-game) block of the daily routine.

Reuses the goal_levels table from the (now removed) Metas feature — same
storage, same up/down rule, just evaluated against match completion instead
of goal completion.
"""

CATEGORY = 'action'

MIN_LEVEL = 1
MAX_LEVEL = 5

# Kills per 15 min GOAT match, calibrated for a high-kill-volume server.
KILLS_PER_MATCH_BY_LEVEL = {1: 40, 2: 60, 3: 80, 4: 100, 5: 130}

EXPERIENCE_INITIAL_LEVEL = {
    'iniciante':     1,
    'intermediario': 2,
    'avancado':      3,
}

LEVEL_UP_NOTE   = 'Meta aumentou — você está evoluindo! 📈'
LEVEL_DOWN_NOTE = 'Meta ajustada para retomar o ritmo'


def initial_level_for_experience(experience_level: str) -> int:
    return EXPERIENCE_INITIAL_LEVEL.get(experience_level, 2)


def _clamp_level(level) -> int:
    try:
        level = int(level)
    except (TypeError, ValueError):
        return 2
    return max(MIN_LEVEL, min(MAX_LEVEL, level))


def adjust_level(current_level: int, recent_results: list):
    """Adaptive difficulty rule, evaluated once per day before the routine
    is generated.

    recent_results: booleans (all matches completed that day?) for the last
    up to 2 prior days that had an in-game block, most-recent first. Days
    without an in-game block (legacy routines) are simply absent from the
    list and don't count either way.

    Returns (new_level, change) where change is None | 'up' | 'down'.
    """
    current_level = _clamp_level(current_level)
    if len(recent_results) < 2:
        return current_level, None

    last_two = recent_results[:2]
    if all(last_two):
        if current_level >= MAX_LEVEL:
            return current_level, None
        return current_level + 1, 'up'
    if not any(last_two):
        if current_level <= MIN_LEVEL:
            return current_level, None
        return current_level - 1, 'down'
    return current_level, None


def level_note_for(change: str) -> str:
    if change == 'up':
        return LEVEL_UP_NOTE
    if change == 'down':
        return LEVEL_DOWN_NOTE
    return ''


def kill_quota_for_level(level: int) -> int:
    return KILLS_PER_MATCH_BY_LEVEL[_clamp_level(level)]


def resolve_action_level(user_id: int, profile: dict):
    """Reads the user's current mata-mata level, applies the adaptive rule
    based on recent match-completion history, persists any change, and
    returns (level, level_note).

    Falls back to a fixed level 1 (+ a log warning) if goal_levels hasn't
    been migrated yet — the routine still generates fine, just without
    adaptive difficulty until then.
    """
    # Imported here (not at module load) so this module stays importable —
    # and its pure functions testable — without a live Supabase connection.
    from database import get_goal_level, upsert_goal_level, get_recent_ingame_completion

    default_level = initial_level_for_experience((profile or {}).get('experience_level', ''))
    try:
        existing      = get_goal_level(user_id, CATEGORY)
        current_level = existing['current_level'] if existing else default_level
        history       = get_recent_ingame_completion(user_id, limit=2)
        new_level, change = adjust_level(current_level, history)
        if existing is None or new_level != current_level:
            upsert_goal_level(user_id, CATEGORY, new_level)
        return new_level, level_note_for(change)
    except Exception as e:
        print(f'[level_service] goal_levels unavailable, falling back to level 1: {e}')
        return 1, ''
