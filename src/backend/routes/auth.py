from datetime import date
from flask import Blueprint, request, jsonify, g
from database import get_db
from utils import (
    require_auth,
    hash_password, verify_password, migrate_password_hash,
    create_access_token, create_refresh_token, refresh_token_expiry, decode_access_token,
    check_rate_limit, reset_rate_limit,
)

auth_bp = Blueprint('auth', __name__)


def _build_auth_response(user_id: int, name: str, username: str, status: int = 200):
    access_token  = create_access_token(user_id)
    refresh_token = create_refresh_token()
    expires_at    = refresh_token_expiry()

    conn = get_db()
    # Clean up old refresh tokens for this user (keep at most last 5)
    old = conn.execute(
        'SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 5',
        (user_id,)
    ).fetchall()
    if old:
        ids = [r['id'] for r in old]
        conn.execute(f"DELETE FROM sessions WHERE id IN ({','.join('?' * len(ids))})", ids)

    conn.execute(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
        (user_id, refresh_token, expires_at),
    )
    conn.commit()
    conn.close()

    return jsonify({
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'user': {'id': user_id, 'name': name, 'username': username},
    }), status


# ── Register ──────────────────────────────────────────────────────────────────

@auth_bp.route('/auth/register', methods=['POST'])
def register():
    data     = request.get_json() or {}
    name     = str(data.get('name',     '')).strip()
    username = str(data.get('username', '')).strip().lower()
    password = str(data.get('password', ''))

    if not name or not username or not password:
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username deve ter pelo menos 3 caracteres'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
    # Basic sanitization
    if len(name) > 80 or len(username) > 40:
        return jsonify({'error': 'Campo muito longo'}), 400
    if not username.replace('_', '').replace('.', '').isalnum():
        return jsonify({'error': 'Username só pode ter letras, números, _ e .'}), 400

    if not check_rate_limit(f'register:{username}', max_attempts=3, window=300):
        return jsonify({'error': 'Muitas tentativas. Aguarde 5 minutos.'}), 429

    conn = get_db()
    if conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone():
        conn.close()
        return jsonify({'error': 'Username já está em uso'}), 409

    pw_hash = hash_password(password)
    c       = conn.cursor()
    c.execute('INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)',
              (name, username, pw_hash))
    user_id = c.lastrowid
    conn.commit()
    conn.close()

    return _build_auth_response(user_id, name, username, status=201)


# ── Login ─────────────────────────────────────────────────────────────────────

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    username = str(data.get('username', '')).strip().lower()
    password = str(data.get('password', ''))

    if not username or not password:
        return jsonify({'error': 'Username e senha são obrigatórios'}), 400

    if not check_rate_limit(f'login:{username}', max_attempts=5, window=60):
        return jsonify({'error': 'Muitas tentativas. Aguarde 1 minuto.'}), 429

    conn = get_db()
    user = conn.execute(
        'SELECT id, name, username, password_hash FROM users WHERE username = ?', (username,)
    ).fetchone()

    if not user or not user['password_hash']:
        conn.close()
        return jsonify({'error': 'Username ou senha incorretos'}), 401

    if not verify_password(password, user['password_hash']):
        conn.close()
        return jsonify({'error': 'Username ou senha incorretos'}), 401

    # Migrate werkzeug hash to bcrypt silently
    if user['password_hash'].startswith('pbkdf2:'):
        migrate_password_hash(user['id'], password, conn)

    conn.close()
    reset_rate_limit(f'login:{username}')
    return _build_auth_response(user['id'], user['name'], user['username'])


# ── Refresh token ─────────────────────────────────────────────────────────────

@auth_bp.route('/auth/refresh', methods=['POST'])
def refresh():
    data          = request.get_json() or {}
    refresh_token = str(data.get('refresh_token', '')).strip()
    if not refresh_token:
        return jsonify({'error': 'Refresh token ausente'}), 400

    conn = get_db()
    row  = conn.execute(
        'SELECT user_id, expires_at FROM sessions WHERE token = ?', (refresh_token,)
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({'error': 'Refresh token inválido'}), 401

    from datetime import datetime, timezone
    if row['expires_at']:
        try:
            exp = datetime.fromisoformat(row['expires_at'])
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp:
                conn.execute('DELETE FROM sessions WHERE token = ?', (refresh_token,))
                conn.commit()
                conn.close()
                return jsonify({'error': 'Refresh token expirado'}), 401
        except ValueError:
            pass

    user_id = row['user_id']

    # Token rotation: delete old, issue new pair
    conn.execute('DELETE FROM sessions WHERE token = ?', (refresh_token,))
    conn.commit()

    user = conn.execute('SELECT name, username FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    return _build_auth_response(user_id, user['name'], user['username'])


# ── Me ────────────────────────────────────────────────────────────────────────

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


# ── Update profile ────────────────────────────────────────────────────────────

@auth_bp.route('/auth/profile', methods=['PUT'])
@require_auth
def update_profile():
    data     = request.get_json() or {}
    name     = str(data.get('name',     '')).strip()
    username = str(data.get('username', '')).strip().lower()

    if not name or not username:
        return jsonify({'error': 'Nome e username são obrigatórios'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username deve ter pelo menos 3 caracteres'}), 400
    if len(name) > 80 or len(username) > 40:
        return jsonify({'error': 'Campo muito longo'}), 400

    conn = get_db()
    if conn.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?', (username, g.user_id)
    ).fetchone():
        conn.close()
        return jsonify({'error': 'Username já está em uso'}), 409

    conn.execute('UPDATE users SET name = ?, username = ? WHERE id = ?',
                 (name, username, g.user_id))
    conn.commit()
    user = conn.execute('SELECT id, name, username FROM users WHERE id = ?', (g.user_id,)).fetchone()
    conn.close()

    return jsonify({'id': user['id'], 'name': user['name'], 'username': user['username']})


# ── Logout ────────────────────────────────────────────────────────────────────

@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    data          = request.get_json() or {}
    refresh_token = str(data.get('refresh_token', '')).strip()
    if refresh_token:
        conn = get_db()
        conn.execute('DELETE FROM sessions WHERE token = ?', (refresh_token,))
        conn.commit()
        conn.close()
    return jsonify({'message': 'Logout realizado'})


# ── Helpers ───────────────────────────────────────────────────────────────────

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
