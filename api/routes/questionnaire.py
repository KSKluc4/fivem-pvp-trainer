from datetime import date
from flask import Blueprint, request, jsonify, g
from database import get_user_by_id, save_questionnaire, create_training_session
from services.routine_generator import generate_routine
from utils import require_auth

questionnaire_bp = Blueprint('questionnaire', __name__)


@questionnaire_bp.route('/questionnaire', methods=['POST'])
@require_auth
def submit_questionnaire():
    data = request.get_json() or {}

    profile = {
        'focus_area':        data.get('focus_area', 'aim'),
        'experience_level':  data.get('experience_level', 'iniciante'),
        'aim_difficulty':    data.get('aim_difficulty', ''),
        'reflex_level':      data.get('reflex_level', ''),
        'movement_quality':  data.get('movement_quality', ''),
        'daily_time':        int(data.get('daily_time', 30)),
        'preferred_tool':    data.get('preferred_tool', 'aimlab'),
        'server_type':       data.get('server_type', ''),
        'main_weapon':       data.get('main_weapon', ''),
        'specific_weakness': data.get('specific_weakness', ''),
    }

    save_questionnaire(g.user_id, profile)
    routine    = generate_routine(profile)
    session_id = create_training_session(g.user_id, date.today().isoformat(), routine)

    user = get_user_by_id(g.user_id)
    name = user['name'] if user else 'Jogador'

    return jsonify({
        'user_id':    g.user_id,
        'session_id': session_id,
        'name':       name,
        'routine':    routine,
    }), 201
