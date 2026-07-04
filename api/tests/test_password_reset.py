import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

from utils import generate_reset_token, hash_reset_token, is_token_expired
import routes.auth as auth_routes


def make_client():
    app = Flask(__name__)
    app.register_blueprint(auth_routes.auth_bp, url_prefix='/api')
    return app.test_client()


# ── Token generation / hashing ────────────────────────────────────────────────

def test_generate_reset_token_is_unique_and_long_enough():
    tokens = {generate_reset_token() for _ in range(50)}
    assert len(tokens) == 50
    assert all(len(t) >= 32 for t in tokens)


def test_hash_reset_token_is_deterministic_sha256_hex():
    token = 'sample-token-value'
    h1 = hash_reset_token(token)
    h2 = hash_reset_token(token)
    assert h1 == h2
    assert len(h1) == 64
    assert all(c in '0123456789abcdef' for c in h1)


def test_hash_reset_token_differs_for_different_tokens():
    assert hash_reset_token('token-a') != hash_reset_token('token-b')


# ── Expiration ────────────────────────────────────────────────────────────────

def test_is_token_expired_true_for_past_timestamp():
    past = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    assert is_token_expired(past) is True


def test_is_token_expired_false_for_future_timestamp():
    future = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    assert is_token_expired(future) is False


def test_is_token_expired_handles_naive_timestamp():
    naive_past = (datetime.now(timezone.utc) - timedelta(hours=2)).replace(tzinfo=None).isoformat()
    assert is_token_expired(naive_past) is True


# ── /auth/forgot-password: always generic, never leaks whether email exists ──

@patch('routes.auth.send_password_reset_email')
@patch('routes.auth.create_password_reset_token')
@patch('routes.auth.count_recent_password_reset_requests')
@patch('routes.auth.get_user_by_email')
def test_forgot_password_unknown_email_returns_generic_message_without_sending(
    mock_get_user, mock_count, mock_create, mock_send,
):
    mock_get_user.return_value = None
    client = make_client()

    res = client.post('/api/auth/forgot-password', json={'email': 'ninguem@example.com'})

    assert res.status_code == 200
    assert res.get_json()['message'] == auth_routes.FORGOT_PASSWORD_MSG
    mock_create.assert_not_called()
    mock_send.assert_not_called()


@patch('routes.auth.send_password_reset_email')
@patch('routes.auth.create_password_reset_token')
@patch('routes.auth.count_recent_password_reset_requests')
@patch('routes.auth.get_user_by_email')
def test_forgot_password_known_email_same_generic_message_and_sends_email(
    mock_get_user, mock_count, mock_create, mock_send,
):
    mock_get_user.return_value = {'id': 1, 'email': 'a@a.com', 'name': 'A'}
    mock_count.return_value = 0
    client = make_client()

    res = client.post('/api/auth/forgot-password', json={'email': 'a@a.com'})

    assert res.status_code == 200
    assert res.get_json()['message'] == auth_routes.FORGOT_PASSWORD_MSG
    mock_create.assert_called_once()
    mock_send.assert_called_once()


@patch('routes.auth.send_password_reset_email')
@patch('routes.auth.create_password_reset_token')
@patch('routes.auth.count_recent_password_reset_requests')
@patch('routes.auth.get_user_by_email')
def test_forgot_password_invalid_email_format_returns_generic_message(
    mock_get_user, mock_count, mock_create, mock_send,
):
    client = make_client()

    res = client.post('/api/auth/forgot-password', json={'email': 'not-an-email'})

    assert res.status_code == 200
    assert res.get_json()['message'] == auth_routes.FORGOT_PASSWORD_MSG
    mock_get_user.assert_not_called()


@patch('routes.auth.send_password_reset_email')
@patch('routes.auth.create_password_reset_token')
@patch('routes.auth.count_recent_password_reset_requests')
@patch('routes.auth.get_user_by_email')
def test_forgot_password_rate_limited_still_generic_and_skips_send(
    mock_get_user, mock_count, mock_create, mock_send,
):
    mock_get_user.return_value = {'id': 1, 'email': 'a@a.com', 'name': 'A'}
    mock_count.return_value = auth_routes.RESET_RATE_LIMIT  # already at the cap
    client = make_client()

    res = client.post('/api/auth/forgot-password', json={'email': 'a@a.com'})

    assert res.status_code == 200
    assert res.get_json()['message'] == auth_routes.FORGOT_PASSWORD_MSG
    mock_create.assert_not_called()
    mock_send.assert_not_called()


# ── /auth/reset-password: token validation, expiration, single use ──────────

@patch('routes.auth.invalidate_user_reset_tokens')
@patch('routes.auth.update_password')
@patch('routes.auth.get_valid_reset_token')
def test_reset_password_rejects_missing_or_unknown_token(mock_get_token, mock_update_pw, mock_invalidate):
    mock_get_token.return_value = None
    client = make_client()

    res = client.post('/api/auth/reset-password', json={'token': 'bogus', 'password': 'newpass123'})

    assert res.status_code == 400
    mock_update_pw.assert_not_called()
    mock_invalidate.assert_not_called()


@patch('routes.auth.invalidate_user_reset_tokens')
@patch('routes.auth.update_password')
@patch('routes.auth.get_valid_reset_token')
def test_reset_password_rejects_expired_token(mock_get_token, mock_update_pw, mock_invalidate):
    past = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    mock_get_token.return_value = {'id': 1, 'user_id': 7, 'expires_at': past, 'used': False}
    client = make_client()

    res = client.post('/api/auth/reset-password', json={'token': 'x', 'password': 'newpass123'})

    assert res.status_code == 400
    mock_update_pw.assert_not_called()
    mock_invalidate.assert_not_called()


@patch('routes.auth.get_valid_reset_token')
def test_reset_password_rejects_used_token(mock_get_token):
    # get_valid_reset_token already filters used=True out of the DB query,
    # so a used token simply comes back as "not found".
    mock_get_token.return_value = None
    client = make_client()

    res = client.post('/api/auth/reset-password', json={'token': 'already-used', 'password': 'newpass123'})

    assert res.status_code == 400
    assert 'inválido' in res.get_json()['error'].lower()


@patch('routes.auth.invalidate_user_reset_tokens')
@patch('routes.auth.update_password')
@patch('routes.auth.get_valid_reset_token')
def test_reset_password_succeeds_with_valid_token_and_invalidates_others(
    mock_get_token, mock_update_pw, mock_invalidate,
):
    future = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    mock_get_token.return_value = {'id': 1, 'user_id': 7, 'expires_at': future, 'used': False}
    client = make_client()

    res = client.post('/api/auth/reset-password', json={'token': 'x', 'password': 'newpass123'})

    assert res.status_code == 200
    mock_update_pw.assert_called_once_with(7, mock_update_pw.call_args[0][1])
    mock_invalidate.assert_called_once_with(7)


def test_reset_password_rejects_short_password():
    client = make_client()

    res = client.post('/api/auth/reset-password', json={'token': 'x', 'password': '123'})

    assert res.status_code == 400
