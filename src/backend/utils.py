from functools import wraps
from collections import defaultdict
from time import time as _now
from datetime import datetime, timedelta, timezone
from flask import request, jsonify, g
import jwt
import bcrypt
from database import get_db, get_secret_key

_JWT_ALGORITHM = 'HS256'
_ACCESS_TTL    = timedelta(hours=24)
_REFRESH_TTL   = timedelta(days=30)

# Loaded once at import time; key persists on disk across restarts
SECRET_KEY = get_secret_key()

# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith('pbkdf2:'):
        # Migrate legacy werkzeug hash transparently
        from werkzeug.security import check_password_hash
        return check_password_hash(stored, password)
    return bcrypt.checkpw(password.encode(), stored.encode())


def migrate_password_hash(user_id: int, password: str, conn) -> str:
    new_hash = hash_password(password)
    conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_hash, user_id))
    conn.commit()
    return new_hash


# ── JWT access tokens ─────────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    payload = {
        'sub':  user_id,
        'type': 'access',
        'iat':  datetime.now(timezone.utc),
        'exp':  datetime.now(timezone.utc) + _ACCESS_TTL,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[_JWT_ALGORITHM])
        if payload.get('type') != 'access':
            return None
        return payload['sub']
    except jwt.PyJWTError:
        return None


# ── Opaque refresh tokens (stored in sessions table) ─────────────────────────

import secrets as _secrets

def create_refresh_token() -> str:
    return _secrets.token_hex(64)


def refresh_token_expiry() -> str:
    return (datetime.now(timezone.utc) + _REFRESH_TTL).isoformat()


# ── In-memory rate limiter (per username, resets each window) ─────────────────

_attempts: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, max_attempts: int = 5, window: int = 60) -> bool:
    now = _now()
    recent = [t for t in _attempts[key] if now - t < window]
    _attempts[key] = recent
    if len(recent) >= max_attempts:
        return False
    _attempts[key].append(now)
    return True


def reset_rate_limit(key: str) -> None:
    _attempts.pop(key, None)


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
