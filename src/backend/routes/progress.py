from flask import Blueprint, request, jsonify, g
from database import get_db
from utils import require_auth
import sync

progress_bp = Blueprint('progress', __name__)


@progress_bp.route('/progress/<int:user_id>', methods=['GET'])
@require_auth
def get_progress(user_id):
    if g.user_id != user_id:
        return jsonify({'error': 'Proibido'}), 403

    conn = get_db()
    c    = conn.cursor()
    c.execute('''
        SELECT ts.date, ts.completed, COUNT(p.id) as exercises_logged
        FROM training_sessions ts
        LEFT JOIN progress p ON p.session_id = ts.id
        WHERE ts.user_id = ?
        GROUP BY ts.id
        ORDER BY ts.date DESC
        LIMIT 30
    ''', (user_id,))
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@progress_bp.route('/progress', methods=['POST'])
@require_auth
def save_progress():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400

    data['user_id'] = g.user_id

    conn = get_db()
    c    = conn.cursor()
    c.execute('''
        INSERT INTO progress (user_id, session_id, exercise_name, score, completed, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data['user_id'],
        data['session_id'],
        data['exercise_name'],
        data.get('score'),
        int(data.get('completed', 0)),
        data.get('notes', ''),
    ))

    if data.get('session_completed'):
        c.execute(
            'UPDATE training_sessions SET completed = 1 WHERE id = ? AND user_id = ?',
            (data['session_id'], g.user_id),
        )

    conn.commit()
    conn.close()

    # Fire-and-forget cloud sync
    sync.sync_async(g.user_id)

    return jsonify({'message': 'Progresso salvo'}), 201
