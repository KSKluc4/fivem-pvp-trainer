import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.trainer as trainer_routes
from utils import create_access_token


def make_client():
    app = Flask(__name__)
    app.register_blueprint(trainer_routes.trainer_bp, url_prefix='/api')
    return app.test_client()


def auth_headers(user_id=7):
    return {'Authorization': f'Bearer {create_access_token(user_id)}'}


VALID_PAYLOAD = {
    'exercise': 'tracking_suave', 'difficulty': 'medio',
    'score': 42000, 'accuracy': 70.0, 'duration_s': 60,
}


# ── POST /trainer/scores — validation ────────────────────────────────────────

@patch('routes.trainer.save_trainer_score')
def test_submit_score_saves_valid_payload(mock_save):
    mock_save.return_value = {'id': 1, **VALID_PAYLOAD}
    client = make_client()

    res = client.post('/api/trainer/scores', json=VALID_PAYLOAD, headers=auth_headers())

    assert res.status_code == 201
    mock_save.assert_called_once_with(7, 'tracking_suave', 'medio', 42000, 70.0, 60)


@patch('routes.trainer.save_trainer_score')
def test_submit_score_requires_exercise_and_difficulty(mock_save):
    client = make_client()
    payload = dict(VALID_PAYLOAD, exercise='')

    res = client.post('/api/trainer/scores', json=payload, headers=auth_headers())

    assert res.status_code == 400
    mock_save.assert_not_called()


@patch('routes.trainer.save_trainer_score')
def test_submit_score_rejects_non_numeric_fields(mock_save):
    client = make_client()
    payload = dict(VALID_PAYLOAD, score='not-a-number')

    res = client.post('/api/trainer/scores', json=payload, headers=auth_headers())

    assert res.status_code == 400
    mock_save.assert_not_called()


@patch('routes.trainer.save_trainer_score')
def test_submit_score_rejects_out_of_range_accuracy(mock_save):
    client = make_client()
    payload = dict(VALID_PAYLOAD, accuracy=150)

    res = client.post('/api/trainer/scores', json=payload, headers=auth_headers())

    assert res.status_code == 400
    mock_save.assert_not_called()


@patch('routes.trainer.save_trainer_score')
def test_submit_score_rejects_negative_score(mock_save):
    client = make_client()
    payload = dict(VALID_PAYLOAD, score=-5)

    res = client.post('/api/trainer/scores', json=payload, headers=auth_headers())

    assert res.status_code == 400
    mock_save.assert_not_called()


@patch('routes.trainer.save_trainer_score')
def test_submit_score_rejects_zero_or_excessive_duration(mock_save):
    client = make_client()

    res_zero = client.post('/api/trainer/scores', json=dict(VALID_PAYLOAD, duration_s=0), headers=auth_headers())
    res_huge = client.post('/api/trainer/scores', json=dict(VALID_PAYLOAD, duration_s=99999), headers=auth_headers())

    assert res_zero.status_code == 400
    assert res_huge.status_code == 400
    mock_save.assert_not_called()


def test_submit_score_requires_auth():
    client = make_client()
    res = client.post('/api/trainer/scores', json=VALID_PAYLOAD)
    assert res.status_code == 401


@patch('routes.trainer.save_trainer_score')
def test_submit_score_degrades_gracefully_when_db_unavailable(mock_save):
    mock_save.side_effect = Exception('table not migrated')
    client = make_client()

    res = client.post('/api/trainer/scores', json=VALID_PAYLOAD, headers=auth_headers())

    assert res.status_code == 503


# ── GET /trainer/scores ───────────────────────────────────────────────────────

@patch('routes.trainer.get_trainer_scores')
def test_list_scores_filters_by_exercise_query_param(mock_get):
    mock_get.return_value = []
    client = make_client()

    res = client.get('/api/trainer/scores?exercise=tracking_suave', headers=auth_headers())

    assert res.status_code == 200
    mock_get.assert_called_once_with(7, 'tracking_suave')


@patch('routes.trainer.get_trainer_scores')
def test_list_scores_degrades_gracefully_when_db_unavailable(mock_get):
    mock_get.side_effect = Exception('table not migrated')
    client = make_client()

    res = client.get('/api/trainer/scores', headers=auth_headers())

    assert res.status_code == 503


def test_list_scores_requires_auth():
    client = make_client()
    res = client.get('/api/trainer/scores')
    assert res.status_code == 401
