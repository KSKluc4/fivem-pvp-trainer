import traceback
from datetime import date
from flask import Blueprint, jsonify, g
from database import (
    get_latest_questionnaire, get_today_session, list_goals, create_goals, toggle_goal,
    get_goal_level, upsert_goal_level, get_recent_category_completions,
)
from services.goal_generator import (
    generate_daily_goals, today_period_start,
    initial_level_for_experience, adjust_level, level_note_for,
    rotating_category_for,
)
from services.routine_generator import generate_routine
from utils import require_auth

goals_bp = Blueprint('goals', __name__)


def _serialize(row: dict) -> dict:
    return {
        'id':           row['id'],
        'period':       row['period'],
        'category':     row['category'],
        'title':        row['title'],
        'description':  row.get('description', ''),
        'completed':    bool(row['completed']),
        'completed_at': row.get('completed_at'),
        'level':        row.get('level'),
        'level_note':   row.get('level_note') or '',
    }


def _resolve_levels(user_id: int, profile: dict, period_start: str):
    """Adaptive difficulty per category, evaluated once per day at goal generation.

    Falls back to a fixed level 1 (and logs a warning) if the goal_levels
    table hasn't been migrated yet — the rest of the goals feature still
    works, just without adaptive difficulty until the migration runs.
    """
    default_level = initial_level_for_experience(profile.get('experience_level', ''))
    period_date   = date.fromisoformat(period_start)
    categories    = ('aim', 'action', rotating_category_for(period_date))

    levels, notes = {}, {}
    for category in categories:
        try:
            existing      = get_goal_level(user_id, category)
            current_level = existing['current_level'] if existing else default_level
            history       = get_recent_category_completions(user_id, category, limit=2)
            new_level, change = adjust_level(current_level, history)
            if existing is None or new_level != current_level:
                upsert_goal_level(user_id, category, new_level)
            levels[category] = new_level
            note = level_note_for(change)
            if note:
                notes[category] = note
        except Exception as e:
            print(f'[goals] goal_levels unavailable, falling back to level 1 for "{category}": {e}')
            levels[category] = 1
    return levels, notes


def _get_or_generate_daily(user_id: int, period_start: str) -> list:
    existing = list_goals(user_id, 'daily', period_start)
    if existing:
        return existing

    profile = get_latest_questionnaire(user_id) or {}
    session = get_today_session(user_id, date.today().isoformat())
    routine = session['routine'] if session else (generate_routine(profile) if profile else None)

    levels, level_notes = _resolve_levels(user_id, profile, period_start)

    goals = generate_daily_goals(user_id, profile, routine, period_start, levels, level_notes)
    return create_goals(user_id, goals)


@goals_bp.route('/goals', methods=['GET'])
@require_auth
def get_goals():
    try:
        daily = [_serialize(r) for r in _get_or_generate_daily(g.user_id, today_period_start())]

        return jsonify({
            'available':      True,
            'daily':          daily,
            'daily_progress': {'completed': sum(1 for r in daily if r['completed']), 'total': len(daily)},
        })
    except Exception:
        traceback.print_exc()
        # Most likely cause: the `goals` table migration hasn't been applied
        # yet. Degrade gracefully instead of breaking the dashboard.
        return jsonify({
            'available':      False,
            'daily':          [],
            'daily_progress': {'completed': 0, 'total': 0},
        })


@goals_bp.route('/goals/<int:goal_id>/toggle', methods=['POST'])
@require_auth
def toggle(goal_id):
    try:
        updated = toggle_goal(goal_id, g.user_id)
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Metas indisponíveis no momento'}), 503

    if not updated:
        return jsonify({'error': 'Meta não encontrada'}), 404
    return jsonify(_serialize(updated))
