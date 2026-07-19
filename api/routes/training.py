from datetime import date
from flask import Blueprint, jsonify, g
from database import get_today_session, get_latest_questionnaire, create_training_session
from services.routine_generator import generate_routine
from services.level_service import resolve_action_level
from services.aim_level import compute_per_exercise_levels, resolve_aim_accelerator
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

    # Aim-trainer data is best-effort — a Supabase hiccup or an un-migrated
    # table here must never block the routine itself, so this stays fully
    # decoupled from resolve_action_level's own error handling.
    try:
        aim_levels = compute_per_exercise_levels(user_id)
        aim_accelerated = resolve_aim_accelerator(user_id, aim_levels)
    except Exception:
        aim_levels, aim_accelerated = {}, False

    routine    = generate_routine(dict(profile), action_level=action_level, action_level_note=action_level_note,
                                   aim_accelerated=aim_accelerated, aim_levels=aim_levels)
    session_id = create_training_session(user_id, today, routine)
    return jsonify({'session_id': session_id, 'routine': routine})
