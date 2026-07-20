import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.auth as auth_routes


def make_client():
    app = Flask(__name__)
    app.register_blueprint(auth_routes.auth_bp, url_prefix='/api')
    return app.test_client()


USER = {
    'id': 1, 'name': 'Jogador', 'username': 'jogador1', 'email': 'jogador1@example.com',
    'password_hash': 'hashed', 'is_admin': 0,
}


@patch('routes.auth.create_session')
@patch('routes.auth.verify_password')
@patch('routes.auth.get_user_by_username')
@patch('routes.auth.get_user_by_email')
def test_login_by_username_succeeds(mock_by_email, mock_by_username, mock_verify, mock_create_session):
    mock_by_username.return_value = USER
    mock_verify.return_value = True
    client = make_client()

    res = client.post('/api/auth/login', json={'identifier': 'jogador1', 'password': 'correct-horse'})

    assert res.status_code == 200
    mock_by_username.assert_called_once_with('jogador1')
    mock_by_email.assert_not_called()
    assert res.get_json()['user']['username'] == 'jogador1'


@patch('routes.auth.create_session')
@patch('routes.auth.verify_password')
@patch('routes.auth.get_user_by_username')
@patch('routes.auth.get_user_by_email')
def test_login_by_email_succeeds(mock_by_email, mock_by_username, mock_verify, mock_create_session):
    mock_by_email.return_value = USER
    mock_verify.return_value = True
    client = make_client()

    res = client.post('/api/auth/login', json={'identifier': 'jogador1@example.com', 'password': 'correct-horse'})

    assert res.status_code == 200
    mock_by_email.assert_called_once_with('jogador1@example.com')
    mock_by_username.assert_not_called()


@patch('routes.auth.create_session')
@patch('routes.auth.verify_password')
@patch('routes.auth.get_user_by_username')
@patch('routes.auth.get_user_by_email')
def test_login_by_email_normalizes_uppercase(mock_by_email, mock_by_username, mock_verify, mock_create_session):
    mock_by_email.return_value = USER
    mock_verify.return_value = True
    client = make_client()

    res = client.post('/api/auth/login', json={'identifier': 'Jogador1@Example.COM', 'password': 'correct-horse'})

    assert res.status_code == 200
    mock_by_email.assert_called_once_with('jogador1@example.com')


@patch('routes.auth.get_user_by_username')
@patch('routes.auth.get_user_by_email')
def test_login_unknown_identifier_returns_generic_error(mock_by_email, mock_by_username):
    mock_by_username.return_value = None
    client = make_client()

    res = client.post('/api/auth/login', json={'identifier': 'ghost', 'password': 'whatever'})

    assert res.status_code == 401
    assert res.get_json()['error'] == 'Username ou senha incorretos'


@patch('routes.auth.verify_password')
@patch('routes.auth.get_user_by_username')
def test_login_wrong_password_returns_generic_error(mock_by_username, mock_verify):
    mock_by_username.return_value = USER
    mock_verify.return_value = False
    client = make_client()

    res = client.post('/api/auth/login', json={'identifier': 'jogador1', 'password': 'wrong'})

    assert res.status_code == 401
    assert res.get_json()['error'] == 'Username ou senha incorretos'


def test_login_missing_fields_returns_400():
    client = make_client()
    res = client.post('/api/auth/login', json={'identifier': '', 'password': ''})
    assert res.status_code == 400
