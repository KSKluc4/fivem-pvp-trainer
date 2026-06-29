import os
import secrets as _secrets
from functools import wraps
from datetime import datetime, timedelta, timezone
from flask import request, jsonify, g
import jwt
import bcrypt

_JWT_ALGORITHM = 'HS256'
_ACCESS_TTL    = timedelta(hours=24)
_REFRESH_TTL   = timedelta(days=30)


def _secret() -> str:
    key = os.environ.get('JWT_SECRET', '')
    if not key:
        raise RuntimeError('JWT_SECRET environment variable is required')
    return key


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith('pbkdf2:'):
        from werkzeug.security import check_password_hash
        return check_password_hash(stored, password)
    return bcrypt.checkpw(password.encode(), stored.encode())


# ── JWT access tokens ─────────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    payload = {
        'sub':  str(user_id),   # PyJWT 2.x requires sub to be a string (RFC 7519)
        'type': 'access',
        'iat':  datetime.now(timezone.utc),
        'exp':  datetime.now(timezone.utc) + _ACCESS_TTL,
    }
    return jwt.encode(payload, _secret(), algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, _secret(), algorithms=[_JWT_ALGORITHM])
        if payload.get('type') != 'access':
            return None
        return int(payload['sub'])
    except (jwt.PyJWTError, ValueError, TypeError):
        return None


# ── Opaque refresh tokens ─────────────────────────────────────────────────────

def create_refresh_token() -> str:
    return _secrets.token_hex(64)


def refresh_token_expiry() -> str:
    return (datetime.now(timezone.utc) + _REFRESH_TTL).isoformat()


# ── Auth decorator ────────────────────────────────────────────────────────────

def require_auth(f):
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
        return f(*args, **kwargs)
    return decorated
