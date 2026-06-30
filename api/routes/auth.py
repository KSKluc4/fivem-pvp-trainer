from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from database import (
    get_user_by_username, get_user_by_id, create_user,
    update_user, update_password, username_taken_by_other,
    create_session, get_session, delete_session, get_user_stats,
)
from utils import (
    require_auth, hash_password, verify_password,
    create_access_token, create_refresh_token, refresh_token_expiry,
)

auth_bp = Blueprint('auth', __name__)


def _build_auth_response(user_id: int, name: str, username: str,
                          is_admin: bool = False, status: int = 200):
    access_token  = create_access_token(user_id)
    refresh_token = create_refresh_token()
    create_session(user_id, refresh_token, refresh_token_expiry())
    return jsonify({
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'user': {'id': user_id, 'name': name, 'username': username, 'is_admin': is_admin},
    }), status


@auth_bp.route('/auth/register', methods=['POST'])
def register():
    import traceback, sys
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
    if len(name) > 80 or len(username) > 40:
        return jsonify({'error': 'Campo muito longo'}), 400
    if not username.replace('_', '').replace('.', '').isalnum():
        return jsonify({'error': 'Username só pode ter letras, números, _ e .'}), 400

    if get_user_by_username(username):
        return jsonify({'error': 'Username já está em uso'}), 409

    pw_hash = hash_password(password)
    user_id = create_user(name, username, pw_hash)
    return _build_auth_response(user_id, name, username, status=201)


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    username = str(data.get('username', '')).strip().lower()
    password = str(data.get('password', ''))

    if not username or not password:
        return jsonify({'error': 'Username e senha são obrigatórios'}), 400

    user = get_user_by_username(username)
    if not user or not user.get('password_hash'):
        return jsonify({'error': 'Username ou senha incorretos'}), 401

    if not verify_password(password, user['password_hash']):
        return jsonify({'error': 'Username ou senha incorretos'}), 401

    # Silently migrate legacy werkzeug hashes to bcrypt
    if user['password_hash'].startswith('pbkdf2:'):
        update_password(user['id'], hash_password(password))

    return _build_auth_response(user['id'], user['name'], user['username'],
                                is_admin=bool(user.get('is_admin', 0)))


@auth_bp.route('/auth/refresh', methods=['POST'])
def refresh():
    data          = request.get_json() or {}
    refresh_token = str(data.get('refresh_token', '')).strip()
    if not refresh_token:
        return jsonify({'error': 'Refresh token ausente'}), 400

    row = get_session(refresh_token)
    if not row:
        return jsonify({'error': 'Refresh token inválido'}), 401

    if row.get('expires_at'):
        try:
            exp = datetime.fromisoformat(str(row['expires_at']))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp:
                delete_session(refresh_token)
                return jsonify({'error': 'Refresh token expirado'}), 401
        except ValueError:
            pass

    user_id = row['user_id']
    delete_session(refresh_token)

    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    return _build_auth_response(user_id, user['name'], user['username'],
                                is_admin=bool(user.get('is_admin', 0)))


@auth_bp.route('/auth/me', methods=['GET'])
@require_auth
def get_me():
    user  = get_user_by_id(g.user_id)
    if not user:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    stats = get_user_stats(g.user_id)
    return jsonify({
        'id':         user['id'],
        'name':       user['name'],
        'username':   user['username'],
        'is_admin':   bool(user.get('is_admin', 0)),
        'created_at': user.get('created_at'),
        'stats':      stats,
    })


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

    if username_taken_by_other(username, g.user_id):
        return jsonify({'error': 'Username já está em uso'}), 409

    updated = update_user(g.user_id, name, username)
    if not updated:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    return jsonify({'id': updated['id'], 'name': updated['name'], 'username': updated['username']})


@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    data          = request.get_json() or {}
    refresh_token = str(data.get('refresh_token', '')).strip()
    if refresh_token:
        delete_session(refresh_token)
    return jsonify({'message': 'Logout realizado'})
