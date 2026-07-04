from datetime import date
from flask import Blueprint, jsonify, g
from database import get_today_session, get_latest_questionnaire, create_training_session
from services.routine_generator import generate_routine
from services.level_service import resolve_action_level
from utils import require_auth

training_bp = Blueprint('training', __name__)


@training_bp.route('/training/<int:user_id>', methods=['GET'])
@require_auth
def get_training(user_id):
    if g.user_id != user_id:
        return jsonify({'error': 'Proibido'}), 403

    today   = date.today().isoformat()
    session = get_today_session(user_id, today)

    if session:
        return jsonify({'session_id': session['id'], 'routine': session['routine']})

    profile = get_latest_questionnaire(user_id)
    if not profile:
        return jsonify({'error': 'Perfil não encontrado'}), 404

    action_level, action_level_note = resolve_action_level(user_id, dict(profile))
    routine    = generate_routine(dict(profile), action_level=action_level, action_level_note=action_level_note)
    session_id = create_training_session(user_id, today, routine)
    return jsonify({'session_id': session_id, 'routine': routine})
