import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.training as training_routes
from utils import create_access_token


def make_client():
    app = Flask(__name__)
    app.register_blueprint(training_routes.training_bp, url_prefix='/api')
    return app.test_client()


def auth_headers(user_id=7):
    return {'Authorization': f'Bearer {create_access_token(user_id)}'}


# ── GET /training/<user_id> — route ──────────────────────────────────────────

def test_forbidden_for_a_different_user():
    client = make_client()
    res = client.get('/api/training/999', headers=auth_headers(7))
    assert res.status_code == 403


def test_requires_auth():
    client = make_client()
    res = client.get('/api/training/7')
    assert res.status_code == 401


def test_reused_today_session_reports_its_real_completed_state():
    with patch('routes.training.get_today_session',
               return_value={'id': 1, 'routine': {'sections': []}, 'completed': True}):
        client = make_client()
        res = client.get('/api/training/7', headers=auth_headers())

        assert res.status_code == 200
        body = res.get_json()
        assert body['session_id'] == 1
        assert body['completed'] is True


def test_reused_today_session_not_yet_completed():
    with patch('routes.training.get_today_session',
               return_value={'id': 1, 'routine': {'sections': []}, 'completed': False}):
        client = make_client()
        res = client.get('/api/training/7', headers=auth_headers())

        assert res.get_json()['completed'] is False


def test_freshly_generated_session_reports_completed_false():
    with patch('routes.training.get_today_session', return_value=None), \
         patch('routes.training.get_latest_questionnaire', return_value={'experience_level': 'iniciante'}), \
         patch('routes.training.resolve_action_level', return_value=(1, '')), \
         patch('routes.training.compute_per_category_levels', return_value={}), \
         patch('routes.training.resolve_aim_accelerator', return_value=False), \
         patch('routes.training.generate_routine', return_value={'sections': []}), \
         patch('routes.training.create_training_session', return_value=42):
        client = make_client()
        res = client.get('/api/training/7', headers=auth_headers())

        assert res.status_code == 200
        body = res.get_json()
        assert body['session_id'] == 42
        assert body['completed'] is False


def test_no_profile_yet_returns_404():
    with patch('routes.training.get_today_session', return_value=None), \
         patch('routes.training.get_latest_questionnaire', return_value=None):
        client = make_client()
        res = client.get('/api/training/7', headers=auth_headers())
        assert res.status_code == 404


def test_aim_data_failure_degrades_to_empty_levels_without_blocking_the_routine():
    with patch('routes.training.get_today_session', return_value=None), \
         patch('routes.training.get_latest_questionnaire', return_value={'experience_level': 'iniciante'}), \
         patch('routes.training.resolve_action_level', return_value=(1, '')), \
         patch('routes.training.compute_per_category_levels', side_effect=Exception('boom')), \
         patch('routes.training.generate_routine', return_value={'sections': []}) as mock_generate, \
         patch('routes.training.create_training_session', return_value=42):
        client = make_client()
        res = client.get('/api/training/7', headers=auth_headers())

        assert res.status_code == 200
        assert res.get_json()['completed'] is False
        _, kwargs = mock_generate.call_args
        assert kwargs['aim_levels'] == {}
        assert kwargs['aim_accelerated'] is False
