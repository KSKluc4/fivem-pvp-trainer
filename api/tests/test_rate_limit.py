import os
import sys
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.auth as auth_routes
from services.rate_limit import check_and_hit, client_ip, _is_missing_table

pytestmark = pytest.mark.rate_limit


def make_client():
    app = Flask(__name__)
    app.register_blueprint(auth_routes.auth_bp, url_prefix='/api')
    return app.test_client()


def _supabase_returning(count):
    """Mock mínimo do encadeamento table().select().eq().gte().execute()."""
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.gte.return_value = chain
    chain.execute.return_value = MagicMock(count=count)
    sb = MagicMock()
    sb.table.return_value = chain
    return sb, chain


# ── check_and_hit ─────────────────────────────────────────────────────────────

@patch('services.rate_limit.get_supabase')
def test_check_and_hit_allows_and_records_below_limit(mock_get_sb):
    sb, chain = _supabase_returning(2)
    mock_get_sb.return_value = sb

    app = Flask(__name__)
    with app.test_request_context('/'):
        assert check_and_hit('login:ip:1.2.3.4', 10, timedelta(minutes=15)) is True

    chain.insert.assert_called_once_with({'bucket': 'login:ip:1.2.3.4'})


@patch('services.rate_limit.get_supabase')
def test_check_and_hit_blocks_at_limit_without_recording(mock_get_sb):
    sb, chain = _supabase_returning(10)
    mock_get_sb.return_value = sb

    app = Flask(__name__)
    with app.test_request_context('/'):
        assert check_and_hit('login:ip:1.2.3.4', 10, timedelta(minutes=15)) is False

    chain.insert.assert_not_called()


@patch('services.rate_limit.get_supabase')
def test_check_and_hit_fails_open_when_supabase_is_down(mock_get_sb):
    mock_get_sb.side_effect = RuntimeError('conexão recusada')

    app = Flask(__name__)
    with app.test_request_context('/'):
        assert check_and_hit('login:ip:1.2.3.4', 10, timedelta(minutes=15), fail_open=True) is True


@patch('services.rate_limit.get_supabase')
def test_check_and_hit_fails_closed_on_paid_route_when_supabase_is_down(mock_get_sb):
    mock_get_sb.side_effect = RuntimeError('conexão recusada')

    app = Flask(__name__)
    with app.test_request_context('/'):
        assert check_and_hit('forgot:ip:1.2.3.4', 5, timedelta(hours=1), fail_open=False) is False


@patch('services.rate_limit.get_supabase')
def test_check_and_hit_lets_through_when_table_not_migrated_yet(mock_get_sb):
    # Regra 3 do CLAUDE.md: o deploy roda antes do SQL. Tabela ausente deixa
    # passar mesmo na rota com fail_open=False — senão o deploy quebraria a
    # redefinição de senha até a migration ser aplicada à mão.
    mock_get_sb.side_effect = RuntimeError(
        "{'code': 'PGRST205', 'message': \"Could not find the table "
        "'public.rate_limit_hits' in the schema cache\"}"
    )

    app = Flask(__name__)
    with app.test_request_context('/'):
        assert check_and_hit('forgot:ip:1.2.3.4', 5, timedelta(hours=1), fail_open=False) is True


def test_is_missing_table_recognizes_postgrest_and_postgres_shapes():
    assert _is_missing_table(RuntimeError('PGRST205 schema cache')) is True
    assert _is_missing_table(RuntimeError('Could not find the table x')) is True
    assert _is_missing_table(RuntimeError('relation "rate_limit_hits" does not exist')) is True
    assert _is_missing_table(RuntimeError('connection refused')) is False


# ── client_ip ─────────────────────────────────────────────────────────────────

def test_client_ip_prefers_first_forwarded_for_entry():
    app = Flask(__name__)
    with app.test_request_context('/', headers={'X-Forwarded-For': '203.0.113.9, 10.0.0.1'}):
        assert client_ip() == '203.0.113.9'


def test_client_ip_falls_back_to_remote_addr():
    app = Flask(__name__)
    with app.test_request_context('/', environ_base={'REMOTE_ADDR': '198.51.100.7'}):
        assert client_ip() == '198.51.100.7'


# ── Rotas ─────────────────────────────────────────────────────────────────────

@patch('routes.auth.check_and_hit')
def test_login_returns_429_when_rate_limited(mock_check):
    mock_check.return_value = False
    res = make_client().post('/api/auth/login', json={'identifier': 'a', 'password': 'b'})

    assert res.status_code == 429
    assert res.get_json()['error'] == auth_routes.TOO_MANY_MSG


@patch('routes.auth.check_and_hit')
def test_register_returns_429_when_rate_limited(mock_check):
    mock_check.return_value = False
    res = make_client().post('/api/auth/register', json={
        'name': 'A', 'username': 'aaa', 'email': 'a@a.com', 'password': 'senha123',
    })

    assert res.status_code == 429


@patch('routes.auth.send_password_reset_email')
@patch('routes.auth.create_password_reset_token')
@patch('routes.auth.count_recent_password_reset_requests')
@patch('routes.auth.get_user_by_email')
@patch('routes.auth.check_and_hit')
def test_forgot_password_rate_limited_by_ip_skips_send_but_stays_generic(
    mock_check, mock_get_user, mock_count, mock_create, mock_send,
):
    mock_check.return_value = False
    mock_get_user.return_value = {'id': 1, 'email': 'a@a.com', 'name': 'A'}
    mock_count.return_value = 0

    res = make_client().post('/api/auth/forgot-password', json={'email': 'a@a.com'})

    # Mesma resposta de sempre: o limite não pode revelar se o email existe.
    assert res.status_code == 200
    assert res.get_json()['message'] == auth_routes.FORGOT_PASSWORD_MSG
    mock_send.assert_not_called()
    mock_create.assert_not_called()
    mock_get_user.assert_not_called()


@patch('routes.auth.check_and_hit')
def test_login_buckets_by_client_ip(mock_check):
    mock_check.return_value = True
    client = make_client()

    with patch('routes.auth.get_user_by_username', return_value=None):
        client.post('/api/auth/login', json={'identifier': 'x', 'password': 'y'},
                    headers={'X-Forwarded-For': '203.0.113.9'})

    bucket = mock_check.call_args[0][0]
    assert bucket == 'login:ip:203.0.113.9'
