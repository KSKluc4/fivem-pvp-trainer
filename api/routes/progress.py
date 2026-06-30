import traceback
from flask import Blueprint, request, jsonify, g
from database import save_progress_entry, mark_session_completed, get_progress_history
from utils import require_auth

progress_bp = Blueprint('progress', __name__)


@progress_bp.route('/progress/<int:user_id>', methods=['GET'])
@require_auth
def get_progress(user_id):
    if g.user_id != user_id:
        return jsonify({'error': 'Proibido'}), 403
    return jsonify(get_progress_history(user_id))


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
