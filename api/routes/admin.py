import traceback
from functools import wraps
from flask import Blueprint, request, jsonify, g
from database import get_user_by_id, get_admin_stats, get_admin_users
from utils import decode_access_token

admin_bp = Blueprint('admin', __name__)


def require_admin(f):
    """Verify JWT and confirm is_admin=1 in DB. Sets g.user_id."""
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        token  = header.replace('Bearer ', '').strip()
        if not token:
            return jsonify({'error': 'Não autorizado'}), 401
        user_id = decode_access_token(token)
        if not user_id:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        g.user_id = user_id
        user = get_user_by_id(user_id)
        if not user or not user.get('is_admin'):
            return jsonify({'error': 'Acesso negado'}), 403
        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/admin/stats', methods=['GET'])
@require_admin
def admin_stats():
    try:
        return jsonify(get_admin_stats()), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Erro ao buscar estatísticas'}), 500


@admin_bp.route('/admin/users', methods=['GET'])
@require_admin
def admin_users():
    try:
        return jsonify(get_admin_users()), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Erro ao buscar usuários'}), 500
