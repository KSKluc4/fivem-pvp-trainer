from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, g
from database import (
    get_user_by_username, get_user_by_id, get_user_by_email, create_user,
    update_user, update_password, username_taken_by_other,
    email_taken_by_other, set_user_email,
    create_session, get_session, delete_session, get_user_stats,
    count_recent_password_reset_requests, create_password_reset_token,
    get_valid_reset_token, invalidate_user_reset_tokens,
)
from utils import (
    require_auth, hash_password, verify_password,
    create_access_token, create_refresh_token, refresh_token_expiry,
    is_valid_email, generate_reset_token, hash_reset_token, is_token_expired,
)
from services.email import send_password_reset_email

auth_bp = Blueprint('auth', __name__)

RESET_TOKEN_TTL    = timedelta(hours=1)
RESET_RATE_LIMIT   = 3
RESET_RATE_WINDOW  = timedelta(hours=1)
FORGOT_PASSWORD_MSG = 'Se este email estiver cadastrado, enviamos um link de redefinição de senha.'


def _build_auth_response(user_id: int, name: str, username: str,
                          is_admin: bool = False, email: str = None,
                          avatar_url: str = None, status: int = 200):
    access_token  = create_access_token(user_id)
    refresh_token = create_refresh_token()
    create_session(user_id, refresh_token, refresh_token_expiry())
    return jsonify({
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user_id, 'name': name, 'username': username, 'is_admin': is_admin,
            'has_email': bool(email), 'avatar_url': avatar_url,
        },
    }), status


@auth_bp.route('/auth/register', methods=['POST'])
def register():
    data     = request.get_json() or {}
    name     = str(data.get('name',     '')).strip()
    username = str(data.get('username', '')).strip().lower()
    email    = str(data.get('email',    '')).strip().lower()
    password = str(data.get('password', ''))

    if not name or not username or not email or not password:
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username deve ter pelo menos 3 caracteres'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
    if len(name) > 80 or len(username) > 40:
        return jsonify({'error': 'Campo muito longo'}), 400
    if not username.replace('_', '').replace('.', '').isalnum():
        return jsonify({'error': 'Username só pode ter letras, números, _ e .'}), 400
    if not is_valid_email(email):
        return jsonify({'error': 'Email inválido'}), 400

    if get_user_by_username(username):
        return jsonify({'error': 'Username já está em uso'}), 409
    if get_user_by_email(email):
        return jsonify({'error': 'Este email já está cadastrado'}), 409

    pw_hash = hash_password(password)
    user_id = create_user(name, username, pw_hash, email=email)
    return _build_auth_response(user_id, name, username, email=email, status=201)


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data       = request.get_json() or {}
    identifier = str(data.get('identifier', '')).strip().lower()
    password   = str(data.get('password', ''))

    if not identifier or not password:
        return jsonify({'error': 'Username/email e senha são obrigatórios'}), 400

    user = get_user_by_email(identifier) if '@' in identifier else get_user_by_username(identifier)
    if not user or not user.get('password_hash'):
        return jsonify({'error': 'Username ou senha incorretos'}), 401

    if not verify_password(password, user['password_hash']):
        return jsonify({'error': 'Username ou senha incorretos'}), 401

    # Silently migrate legacy werkzeug hashes to bcrypt
    if user['password_hash'].startswith('pbkdf2:'):
        update_password(user['id'], hash_password(password))

    return _build_auth_response(user['id'], user['name'], user['username'],
                                is_admin=bool(user.get('is_admin', 0)), email=user.get('email'),
                                avatar_url=user.get('avatar_url'))


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
                                is_admin=bool(user.get('is_admin', 0)), email=user.get('email'),
                                avatar_url=user.get('avatar_url'))


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
        'has_email':  bool(user.get('email')),
        'created_at': user.get('created_at'),
        'avatar_url': user.get('avatar_url'),
        'banner_url': user.get('banner_url'),
        'bio':        user.get('bio') or '',
        'stats':      stats,
    })


@auth_bp.route('/auth/email', methods=['POST'])
@require_auth
def add_email():
    data  = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()

    if not is_valid_email(email):
        return jsonify({'error': 'Email inválido'}), 400
    if email_taken_by_other(email, g.user_id):
        return jsonify({'error': 'Este email já está cadastrado'}), 409

    updated = set_user_email(g.user_id, email)
    if not updated:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    return jsonify({'email': updated['email']})


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


@auth_bp.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    data  = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()

    # Always return the same generic message regardless of what happens below —
    # this endpoint must never reveal whether an email is registered.
    if is_valid_email(email):
        user = get_user_by_email(email)
        if user:
            since  = (datetime.now(timezone.utc) - RESET_RATE_WINDOW).isoformat()
            recent = count_recent_password_reset_requests(user['id'], since)
            if recent < RESET_RATE_LIMIT:
                token      = generate_reset_token()
                expires_at = (datetime.now(timezone.utc) + RESET_TOKEN_TTL).isoformat()
                create_password_reset_token(user['id'], hash_reset_token(token), expires_at)

                reset_url = f"{request.host_url.rstrip('/')}/reset-password?token={token}"
                send_password_reset_email(user['email'], user['name'], reset_url)

    return jsonify({'message': FORGOT_PASSWORD_MSG}), 200


@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    data     = request.get_json() or {}
    token    = str(data.get('token', '')).strip()
    password = str(data.get('password', ''))

    if not token or not password:
        return jsonify({'error': 'Token e nova senha são obrigatórios'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400

    row = get_valid_reset_token(hash_reset_token(token))
    if not row or is_token_expired(row['expires_at']):
        return jsonify({'error': 'Link de redefinição inválido ou expirado'}), 400

    update_password(row['user_id'], hash_password(password))
    invalidate_user_reset_tokens(row['user_id'])

    return jsonify({'message': 'Senha redefinida com sucesso'})
