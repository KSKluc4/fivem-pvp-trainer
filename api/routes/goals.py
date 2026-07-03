import traceback
from datetime import date
from flask import Blueprint, jsonify, g
from database import get_latest_questionnaire, get_today_session, list_goals, create_goals, toggle_goal
from services.goal_generator import (
    generate_daily_goals, generate_weekly_goals,
    today_period_start, week_period_start, next_reset_date,
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
    }


def _get_or_generate_daily(user_id: int, period_start: str) -> list:
    existing = list_goals(user_id, 'daily', period_start)
    if existing:
        return existing

    profile = get_latest_questionnaire(user_id) or {}
    session = get_today_session(user_id, date.today().isoformat())
    routine = session['routine'] if session else (generate_routine(profile) if profile else None)

    goals = generate_daily_goals(user_id, profile, routine, period_start)
    return create_goals(user_id, goals)


def _get_or_generate_weekly(user_id: int, period_start: str) -> list:
    existing = list_goals(user_id, 'weekly', period_start)
    if existing:
        return existing

    profile = get_latest_questionnaire(user_id) or {}
    goals   = generate_weekly_goals(user_id, profile, period_start)
    return create_goals(user_id, goals)


@goals_bp.route('/goals', methods=['GET'])
@require_auth
def get_goals():
    try:
        daily  = [_serialize(r) for r in _get_or_generate_daily(g.user_id, today_period_start())]
        weekly = [_serialize(r) for r in _get_or_generate_weekly(g.user_id, week_period_start())]

        return jsonify({
            'available':        True,
            'daily':            daily,
            'weekly':           weekly,
            'daily_progress':   {'completed': sum(1 for r in daily  if r['completed']), 'total': len(daily)},
            'weekly_progress':  {'completed': sum(1 for r in weekly if r['completed']), 'total': len(weekly)},
            'weekly_resets_at': next_reset_date(),
        })
    except Exception:
        traceback.print_exc()
        # Most likely cause: the `goals` table migration hasn't been applied
        # yet. Degrade gracefully instead of breaking the dashboard.
        return jsonify({
            'available':        False,
            'daily':            [],
            'weekly':           [],
            'daily_progress':   {'completed': 0, 'total': 0},
            'weekly_progress':  {'completed': 0, 'total': 0},
            'weekly_resets_at': next_reset_date(),
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
