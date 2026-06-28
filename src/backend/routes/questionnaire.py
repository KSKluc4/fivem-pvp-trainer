import json
from datetime import date
from flask import Blueprint, request, jsonify
from database import get_db
from services.routine_generator import generate_routine

questionnaire_bp = Blueprint('questionnaire', __name__)


@questionnaire_bp.route('/questionnaire', methods=['POST'])
def submit_questionnaire():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    name              = data.get('name', 'Jogador')
    focus_area        = data.get('focus_area', 'aim')
    experience_level  = data.get('experience_level', 'iniciante')
    aim_difficulty    = data.get('aim_difficulty', '')
    reflex_level      = data.get('reflex_level', '')
    movement_quality  = data.get('movement_quality', '')
    daily_time        = int(data.get('daily_time', 30))
    preferred_tool    = data.get('preferred_tool', 'aimlab')
    server_type       = data.get('server_type', '')
    main_weapon       = data.get('main_weapon', '')
    specific_weakness = data.get('specific_weakness', '')

    conn = get_db()
    c = conn.cursor()

    c.execute('INSERT INTO users (name) VALUES (?)', (name,))
    user_id = c.lastrowid

    c.execute('''
        INSERT INTO questionnaire_results
        (user_id, focus_area, experience_level, aim_difficulty, reflex_level,
         movement_quality, daily_time, preferred_tool,
         server_type, main_weapon, specific_weakness)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, focus_area, experience_level, aim_difficulty, reflex_level,
          movement_quality, daily_time, preferred_tool,
          server_type, main_weapon, specific_weakness))

    profile = {
        'focus_area':        focus_area,
        'experience_level':  experience_level,
        'daily_time':        daily_time,
        'preferred_tool':    preferred_tool,
        'main_weapon':       main_weapon,
        'server_type':       server_type,
        'specific_weakness': specific_weakness,
    }
    routine = generate_routine(profile)

    c.execute(
        'INSERT INTO training_sessions (user_id, date, routine) VALUES (?, ?, ?)',
        (user_id, date.today().isoformat(), json.dumps(routine))
    )
    session_id = c.lastrowid

    conn.commit()
    conn.close()

    return jsonify({
        'user_id':    user_id,
        'session_id': session_id,
        'name':       name,
        'routine':    routine,
    }), 201
