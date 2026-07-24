from datetime import date
from flask import Blueprint, request, jsonify, g
from database import get_user_by_id, save_questionnaire, create_training_session
from services.routine_generator import generate_routine
from services.level_service import resolve_action_level
from utils import require_auth

questionnaire_bp = Blueprint('questionnaire', __name__)

# specific_weakness/focus_area/aim_difficulty support up to 2 selections
# (SPEC-004) — the UI already caps at 2, this is a defensive server-side
# normalization for any payload that reaches this endpoint some other way.
# From here on, profile[these 3 keys] is ALWAYS a list of 1-2 non-empty
# strings — save_questionnaire/generate_routine only ever see lists for them.


def _as_list(value, default):
    if isinstance(value, list):
        items = [str(v).strip() for v in value if v and str(v).strip()]
    elif value:
        items = [str(value).strip()]
    else:
        items = []
    items = list(dict.fromkeys(items))[:2]  # dedupe, cap at 2
    return items or ([default] if default else [])


@questionnaire_bp.route('/questionnaire', methods=['POST'])
@require_auth
def submit_questionnaire():
    data = request.get_json() or {}

    profile = {
        'focus_area':        _as_list(data.get('focus_area'), 'aim'),
        'experience_level':  data.get('experience_level', 'iniciante'),
        'aim_difficulty':    _as_list(data.get('aim_difficulty'), ''),
        'reflex_level':      data.get('reflex_level', ''),
        'movement_quality':  data.get('movement_quality', ''),
        'daily_time':        int(data.get('daily_time', 30)),
        'preferred_tool':    data.get('preferred_tool', 'aimlab'),
        'main_weapon':       data.get('main_weapon', ''),
        'specific_weakness': _as_list(data.get('specific_weakness'), ''),
    }

    save_questionnaire(g.user_id, profile)
    action_level, action_level_note = resolve_action_level(g.user_id, profile)
    routine    = generate_routine(profile, action_level=action_level, action_level_note=action_level_note)
    session_id = create_training_session(g.user_id, date.today().isoformat(), routine)

    user = get_user_by_id(g.user_id)
    name = user['name'] if user else 'Jogador'

    return jsonify({
        'user_id':    g.user_id,
        'session_id': session_id,
        'name':       name,
        'routine':    routine,
    }), 201
