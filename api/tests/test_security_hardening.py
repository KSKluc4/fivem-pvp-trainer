"""Levas 2 da auditoria: escape no email (5b), daily_time tolerante (5c),
erro genérico no /progress (8) e registro de eventos de segurança (10-A)."""
import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.auth as auth_routes
import routes.progress as progress_routes
import routes.questionnaire as questionnaire_routes
from services.email import _reset_html
from utils import create_access_token


def _client(blueprint):
    app = Flask(__name__)
    app.register_blueprint(blueprint, url_prefix='/api')
    return app.test_client()


def _auth_header(user_id=7):
    return {'Authorization': f'Bearer {create_access_token(user_id)}'}


# ── 5b: nome do usuário escapado no HTML do email ────────────────────────────

def test_reset_html_escapes_html_in_user_name():
    body = _reset_html('<b>hax</b>', 'https://exemplo.com/reset?token=x')

    assert '<b>hax</b>' not in body
    assert '&lt;b&gt;hax&lt;/b&gt;' in body


def test_reset_html_escapes_quotes_that_could_break_out_of_an_attribute():
    body = _reset_html('a" onload="alert(1)', 'https://exemplo.com/reset?token=x')

    assert 'onload="alert(1)' not in body
    assert '&quot;' in body


def test_reset_html_without_name_falls_back_to_plain_greeting():
    body = _reset_html('', 'https://exemplo.com/reset?token=x')

    assert 'Olá.' in body
    assert 'Hi,' in body


def test_reset_html_keeps_the_link_usable():
    url = 'https://fivem-pvp-trainer.vercel.app/reset-password?token=abc123'
    assert f'href="{url}"' in _reset_html('Jogador', url)


# ── 5c: daily_time não-numérico não derruba mais a rota ──────────────────────

def test_as_int_falls_back_to_default_for_garbage():
    assert questionnaire_routes._as_int('abc', 30, 5, 240) == 30
    assert questionnaire_routes._as_int(None, 30, 5, 240) == 30
    assert questionnaire_routes._as_int({}, 30, 5, 240) == 30


def test_as_int_clamps_to_the_allowed_range():
    assert questionnaire_routes._as_int(99999, 30, 5, 240) == 240
    assert questionnaire_routes._as_int(-50, 30, 5, 240) == 5
    assert questionnaire_routes._as_int(45, 30, 5, 240) == 45


def test_build_profile_survives_non_numeric_daily_time():
    profile = questionnaire_routes._build_profile_from_payload({'daily_time': 'abc'})
    assert profile['daily_time'] == 30


@patch('routes.questionnaire.get_user_by_id')
@patch('routes.questionnaire.create_training_session')
@patch('routes.questionnaire.resolve_action_level')
@patch('routes.questionnaire.save_questionnaire')
def test_submit_questionnaire_with_bad_daily_time_returns_201_not_500(
    mock_save, mock_level, mock_create_session, mock_get_user,
):
    mock_level.return_value = (1, None)
    mock_create_session.return_value = 42
    mock_get_user.return_value = {'name': 'Jogador'}

    res = _client(questionnaire_routes.questionnaire_bp).post(
        '/api/questionnaire',
        json={'focus_area': 'aim', 'daily_time': 'abc'},
        headers=_auth_header(),
    )

    assert res.status_code == 201
    assert mock_save.call_args[0][1]['daily_time'] == 30


# ── 8: /progress não devolve mais a exceção crua ─────────────────────────────

@patch('routes.progress.save_progress_entry')
def test_save_progress_hides_the_raw_database_error(mock_save):
    mock_save.side_effect = RuntimeError(
        'relation "progress" violates foreign key constraint "progress_session_id_fkey"'
    )

    res = _client(progress_routes.progress_bp).post(
        '/api/progress',
        json={'session_id': 1, 'exercise_name': 'x'},
        headers=_auth_header(),
    )

    assert res.status_code == 500
    body = res.get_json()['error']
    assert body == 'Não foi possível salvar o progresso agora.'
    for leak in ('progress_session_id_fkey', 'relation', 'constraint'):
        assert leak not in body


# ── 10-A: eventos de segurança registrados ───────────────────────────────────

def _security_lines(captured: str):
    return [
        json.loads(line[len('[SECURITY] '):])
        for line in captured.splitlines()
        if line.startswith('[SECURITY] ')
    ]


@patch('routes.auth.get_user_by_username')
def test_failed_login_unknown_user_is_logged_with_ip(mock_by_username, capsys):
    mock_by_username.return_value = None

    _client(auth_routes.auth_bp).post(
        '/api/auth/login',
        json={'identifier': 'fantasma', 'password': 'x'},
        headers={'X-Forwarded-For': '203.0.113.9'},
    )

    events = _security_lines(capsys.readouterr().out)
    assert len(events) == 1
    assert events[0]['event'] == 'login_failed'
    assert events[0]['reason'] == 'user_not_found'
    assert events[0]['ip'] == '203.0.113.9'


@patch('routes.auth.verify_password')
@patch('routes.auth.get_user_by_username')
def test_failed_login_bad_password_is_logged_without_the_password(
    mock_by_username, mock_verify, capsys,
):
    mock_by_username.return_value = {'id': 3, 'name': 'A', 'username': 'a', 'password_hash': 'h'}
    mock_verify.return_value = False

    _client(auth_routes.auth_bp).post(
        '/api/auth/login', json={'identifier': 'a', 'password': 'senha-secreta'},
    )

    out = capsys.readouterr().out
    events = _security_lines(out)
    assert events[0]['event'] == 'login_failed'
    assert events[0]['reason'] == 'bad_password'
    assert events[0]['user_id'] == 3
    assert 'senha-secreta' not in out


def test_successful_login_logs_nothing(capsys):
    with patch('routes.auth.get_user_by_username') as mock_user, \
         patch('routes.auth.verify_password', return_value=True), \
         patch('routes.auth.create_session'):
        mock_user.return_value = {
            'id': 3, 'name': 'A', 'username': 'a', 'password_hash': 'h', 'is_admin': 0,
        }
        res = _client(auth_routes.auth_bp).post(
            '/api/auth/login', json={'identifier': 'a', 'password': 'certa'},
        )

    assert res.status_code == 200
    assert _security_lines(capsys.readouterr().out) == []


def test_cross_user_access_attempt_is_logged(capsys):
    res = _client(progress_routes.progress_bp).get('/api/progress/999', headers=_auth_header(7))

    assert res.status_code == 403
    events = _security_lines(capsys.readouterr().out)
    assert events[0]['event'] == 'forbidden_cross_user'
    assert events[0]['actor'] == 7
    assert events[0]['target'] == 999


@patch('routes.admin.get_user_by_id')
def test_non_admin_hitting_admin_route_is_logged(mock_get_user, capsys):
    import routes.admin as admin_routes
    mock_get_user.return_value = {'id': 7, 'is_admin': 0}

    res = _client(admin_routes.admin_bp).get('/api/admin/users', headers=_auth_header(7))

    assert res.status_code == 403
    events = _security_lines(capsys.readouterr().out)
    assert events[0]['event'] == 'forbidden_admin'
    assert events[0]['actor'] == 7


def test_security_event_never_raises_outside_a_request():
    from services.security_log import security_event
    # Sem contexto de requisição o acesso a request.path explodiria — o
    # try/except interno é o que garante que registrar nunca derrube a rota.
    security_event('smoke_test', foo='bar')
