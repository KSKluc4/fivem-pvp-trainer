import secrets
from datetime import date
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db
from utils import require_auth

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/auth/register', methods=['POST'])
def register():
    data     = request.get_json() or {}
    name     = data.get('name', '').strip()
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')

    if not name or not username or not password:
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username deve ter pelo menos 3 caracteres'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400

    conn = get_db()
    if conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone():
        conn.close()
        return jsonify({'error': 'Username já está em uso'}), 409

    pw_hash = generate_password_hash(password)
    c       = conn.cursor()
    c.execute(
        'INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)',
        (name, username, pw_hash),
    )
    user_id = c.lastrowid
    token   = secrets.token_hex(32)
    c.execute('INSERT INTO sessions (user_id, token) VALUES (?, ?)', (user_id, token))
    conn.commit()
    conn.close()

    return jsonify({
        'token': token,
        'user': {'id': user_id, 'name': name, 'username': username},
    }), 201


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username e senha são obrigatórios'}), 400

    conn = get_db()
    user = conn.execute(
        'SELECT id, name, username, password_hash FROM users WHERE username = ?', (username,)
    ).fetchone()

    if not user or not user['password_hash'] or \
            not check_password_hash(user['password_hash'], password):
        conn.close()
        return jsonify({'error': 'Username ou senha incorretos'}), 401

    token = secrets.token_hex(32)
    conn.execute('INSERT INTO sessions (user_id, token) VALUES (?, ?)', (user['id'], token))
    conn.commit()
    conn.close()

    return jsonify({
        'token': token,
        'user': {'id': user['id'], 'name': user['name'], 'username': user['username']},
    })


@auth_bp.route('/auth/me', methods=['GET'])
@require_auth
def get_me():
    conn = get_db()
    user = conn.execute(
        'SELECT id, name, username, created_at FROM users WHERE id = ?', (g.user_id,)
    ).fetchone()

    days = conn.execute(
        'SELECT COUNT(DISTINCT date) as cnt FROM training_sessions WHERE user_id = ?',
        (g.user_id,),
    ).fetchone()

    sessions_done = conn.execute(
        'SELECT COUNT(*) as cnt FROM training_sessions WHERE user_id = ? AND completed = 1',
        (g.user_id,),
    ).fetchone()

    exs_done = conn.execute(
        "SELECT COUNT(*) as cnt FROM progress "
        "WHERE user_id = ? AND completed = 1 AND exercise_name != '__session__'",
        (g.user_id,),
    ).fetchone()

    dates = conn.execute(
        'SELECT DISTINCT date FROM training_sessions '
        'WHERE user_id = ? AND completed = 1 ORDER BY date DESC',
        (g.user_id,),
    ).fetchall()
    conn.close()

    return jsonify({
        'id':         user['id'],
        'name':       user['name'],
        'username':   user['username'],
        'created_at': user['created_at'],
        'stats': {
            'days_trained':       days['cnt'] or 0,
            'sessions_completed': sessions_done['cnt'] or 0,
            'exercises_done':     exs_done['cnt'] or 0,
            'streak':             _calc_streak([r['date'] for r in dates]),
        },
    })


def _calc_streak(dates):
    from datetime import timedelta
    if not dates:
        return 0
    today  = date.today()
    streak = 0
    prev   = today
    for d in dates:
        day = date.fromisoformat(d)
        if (prev - day).days <= 1:
            streak += 1
            prev = day
        else:
            break
    return streak


@auth_bp.route('/auth/profile', methods=['PUT'])
@require_auth
def update_profile():
    data     = request.get_json() or {}
    name     = data.get('name', '').strip()
    username = data.get('username', '').strip().lower()

    if not name or not username:
        return jsonify({'error': 'Nome e username são obrigatórios'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username deve ter pelo menos 3 caracteres'}), 400

    conn = get_db()
    if conn.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?', (username, g.user_id)
    ).fetchone():
        conn.close()
        return jsonify({'error': 'Username já está em uso'}), 409

    conn.execute(
        'UPDATE users SET name = ?, username = ? WHERE id = ?',
        (name, username, g.user_id),
    )
    conn.commit()
    user = conn.execute('SELECT id, name, username FROM users WHERE id = ?', (g.user_id,)).fetchone()
    conn.close()

    return jsonify({'id': user['id'], 'name': user['name'], 'username': user['username']})


@auth_bp.route('/auth/logout', methods=['POST'])
@require_auth
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    conn  = get_db()
    conn.execute('DELETE FROM sessions WHERE token = ?', (token,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Logout realizado'})
