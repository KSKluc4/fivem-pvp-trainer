from functools import wraps
from flask import request, jsonify, g
from database import get_db


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
        if not token:
            return jsonify({'error': 'Não autorizado'}), 401
        conn = get_db()
        row = conn.execute('SELECT user_id FROM sessions WHERE token = ?', (token,)).fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        g.user_id = row['user_id']
        return f(*args, **kwargs)
    return decorated
