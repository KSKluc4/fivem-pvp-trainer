import traceback
from flask import Blueprint, request, jsonify, g
from database import (
    save_progress_entry, mark_session_completed, get_progress_history,
    get_action_level_summary, get_activity_heatmap,
)
from utils import require_auth

progress_bp = Blueprint('progress', __name__)

DEFAULT_HEATMAP_DAYS = 90
MAX_HEATMAP_DAYS = 365


@progress_bp.route('/progress/<int:user_id>', methods=['GET'])
@require_auth
def get_progress(user_id):
    if g.user_id != user_id:
        return jsonify({'error': 'Proibido'}), 403
    return jsonify(get_progress_history(user_id))


@progress_bp.route('/progress/<int:user_id>/action-level', methods=['GET'])
@require_auth
def get_action_level(user_id):
    if g.user_id != user_id:
        return jsonify({'error': 'Proibido'}), 403
    summary = get_action_level_summary(user_id)
    return jsonify(summary)  # None -> JSON null when the user has no goal_levels row yet


@progress_bp.route('/progress/<int:user_id>/heatmap', methods=['GET'])
@require_auth
def get_heatmap(user_id):
    if g.user_id != user_id:
        return jsonify({'error': 'Proibido'}), 403
    try:
        days = max(1, min(MAX_HEATMAP_DAYS, int(request.args.get('days', DEFAULT_HEATMAP_DAYS))))
    except (TypeError, ValueError):
        return jsonify({'error': 'days inválido.'}), 400
    return jsonify(get_activity_heatmap(user_id, days=days))


@progress_bp.route('/progress', methods=['POST'])
@require_auth
def save_progress():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400

    try:
        save_progress_entry(
            user_id       = g.user_id,
            session_id    = data['session_id'],
            exercise_name = data['exercise_name'],
            score         = data.get('score'),
            completed     = bool(data.get('completed', 0)),
            notes         = data.get('notes', ''),
        )

        if data.get('session_completed'):
            mark_session_completed(data['session_id'], g.user_id)

        return jsonify({'message': 'Progresso salvo'}), 201

    except Exception as exc:
        traceback.print_exc()
        return jsonify({'error': str(exc)}), 500
