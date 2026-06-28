import json
from datetime import date
from flask import Blueprint, jsonify
from database import get_db
from services.routine_generator import generate_routine

training_bp = Blueprint('training', __name__)


@training_bp.route('/training/<int:user_id>', methods=['GET'])
def get_training(user_id):
    conn = get_db()
    c = conn.cursor()

    c.execute('''
        SELECT * FROM training_sessions
        WHERE user_id = ? AND date = ?
        ORDER BY created_at DESC LIMIT 1
    ''', (user_id, date.today().isoformat()))
    session = c.fetchone()

    if session:
        routine = json.loads(session['routine'])
        session_id = session['id']
    else:
        c.execute('''
            SELECT * FROM questionnaire_results
            WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 1
        ''', (user_id,))
        profile = c.fetchone()

        if not profile:
            conn.close()
            return jsonify({'error': 'Perfil não encontrado'}), 404

        routine = generate_routine(dict(profile))
        c.execute(
            'INSERT INTO training_sessions (user_id, date, routine) VALUES (?, ?, ?)',
            (user_id, date.today().isoformat(), json.dumps(routine))
        )
        session_id = c.lastrowid
        conn.commit()

    conn.close()
    return jsonify({'session_id': session_id, 'routine': routine})
