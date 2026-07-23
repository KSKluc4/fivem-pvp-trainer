import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.sensitivity as sensitivity_routes
from routes.sensitivity import _cm_per_360
from utils import create_access_token


def make_client():
    app = Flask(__name__)
    app.register_blueprint(sensitivity_routes.sensitivity_bp, url_prefix='/api')
    return app.test_client()


def auth_headers(user_id=7):
    return {'Authorization': f'Bearer {create_access_token(user_id)}'}


# ── Conceptual fix: -100..100 is a continuous speed dial, not axis-invert ────

def test_reference_anchor_is_preserved():
    # Community-validated reference: sens=50, 800 dpi -> 25.4 cm/360.
    assert round(_cm_per_360(50, 800), 1) == 25.4


def test_cm_per_360_is_strictly_monotonic_across_the_whole_domain():
    # For any a < b in [-100, 100], cm360(a) > cm360(b) — slower (negative)
    # always needs more physical mouse movement than faster (positive).
    values = list(range(-100, 101, 5))
    cms = [_cm_per_360(v, 800) for v in values]
    for i in range(len(cms) - 1):
        assert cms[i] > cms[i + 1], f'{values[i]} -> {cms[i]} should be > {values[i+1]} -> {cms[i+1]}'


def test_negative_and_positive_same_magnitude_are_not_equal():
    # The old bug: abs(sens) collapsed -30 and +30 to the identical value.
    assert _cm_per_360(-30, 800) != _cm_per_360(30, 800)
    assert _cm_per_360(-30, 800) > _cm_per_360(30, 800)  # negative is slower


def test_domain_never_degenerates_to_zero_or_negative_magnitude():
    # Every value in the valid range (including the slowest extreme, -100,
    # and zero) must yield a finite, positive cm/360.
    for v in (-100, -50, 0, 1, 50, 100):
        cm = _cm_per_360(v, 800)
        assert cm > 0
        assert cm != float('inf')


# ── Route behavior ────────────────────────────────────────────────────────────

@patch('routes.sensitivity.update_user_sensitivity')
def test_zero_is_now_a_valid_sensitivity(mock_update):
    # Previously rejected as "would cause infinite rotation" — no longer
    # true under the corrected, always-positive-magnitude formula.
    mock_update.return_value = {'gta_sensitivity': 0, 'dpi': 800, 'fine_tune_multiplier': 1.0}
    client = make_client()

    res = client.put('/api/sensitivity', json={'gta_sensitivity': 0, 'dpi': 800}, headers=auth_headers())

    assert res.status_code == 200
    mock_update.assert_called_once()


@patch('routes.sensitivity.update_user_sensitivity')
def test_response_never_carries_an_inverted_field(mock_update):
    mock_update.return_value = {'gta_sensitivity': -40, 'dpi': 800, 'fine_tune_multiplier': 1.0}
    client = make_client()

    res = client.put('/api/sensitivity', json={'gta_sensitivity': -40, 'dpi': 800}, headers=auth_headers())

    assert res.status_code == 200
    assert 'inverted' not in res.get_json()


@patch('routes.sensitivity.update_user_sensitivity')
def test_negative_sensitivity_saves_successfully(mock_update):
    mock_update.return_value = {'gta_sensitivity': -30, 'dpi': 800, 'fine_tune_multiplier': 1.0}
    client = make_client()

    res = client.put('/api/sensitivity', json={'gta_sensitivity': -30, 'dpi': 800}, headers=auth_headers())

    assert res.status_code == 200
    body = res.get_json()
    assert body['gta_sensitivity'] == -30
    assert body['cm_per_360'] > 0


def test_rejects_out_of_range_sensitivity():
    client = make_client()
    res = client.put('/api/sensitivity', json={'gta_sensitivity': 150, 'dpi': 800}, headers=auth_headers())
    assert res.status_code == 400


def test_rejects_invalid_dpi():
    client = make_client()
    res = client.put('/api/sensitivity', json={'gta_sensitivity': 50, 'dpi': -1}, headers=auth_headers())
    assert res.status_code == 400


def test_requires_auth():
    client = make_client()
    res = client.put('/api/sensitivity', json={'gta_sensitivity': 50, 'dpi': 800})
    assert res.status_code == 401


# ── Sensitivity discovery — POST /sensitivity/calibrations ──────────────────

VALID_CALIBRATION = {
    'sens_at_test': 50, 'dpi_at_test': 800, 'verdict': 'diminuir',
    'flick_ratio_median': 1.15, 'overshoot_rate': 80.0,
    'tracking_error': 3.2, 'suggested_sens': 40,
}


@patch('routes.sensitivity.save_sens_calibration')
def test_submit_calibration_saves_valid_payload(mock_save):
    mock_save.return_value = {'id': 1, **VALID_CALIBRATION}
    client = make_client()

    res = client.post('/api/sensitivity/calibrations', json=VALID_CALIBRATION, headers=auth_headers())

    assert res.status_code == 201
    mock_save.assert_called_once()


@patch('routes.sensitivity.save_sens_calibration')
def test_submit_calibration_accepts_null_optional_metrics(mock_save):
    # An "inconclusivo" verdict has no suggested_sens/ratio at all.
    mock_save.return_value = {'id': 2, 'verdict': 'inconclusivo'}
    client = make_client()
    payload = {'sens_at_test': 50, 'dpi_at_test': 800, 'verdict': 'inconclusivo'}

    res = client.post('/api/sensitivity/calibrations', json=payload, headers=auth_headers())

    assert res.status_code == 201
    mock_save.assert_called_once()


@patch('routes.sensitivity.save_sens_calibration')
def test_submit_calibration_rejects_invalid_verdict(mock_save):
    client = make_client()
    payload = dict(VALID_CALIBRATION, verdict='invalido')

    res = client.post('/api/sensitivity/calibrations', json=payload, headers=auth_headers())

    assert res.status_code == 400
    mock_save.assert_not_called()


@patch('routes.sensitivity.save_sens_calibration')
def test_submit_calibration_rejects_non_numeric_sens_or_dpi(mock_save):
    client = make_client()

    res = client.post(
        '/api/sensitivity/calibrations',
        json=dict(VALID_CALIBRATION, sens_at_test='not-a-number'),
        headers=auth_headers(),
    )

    assert res.status_code == 400
    mock_save.assert_not_called()


def test_submit_calibration_requires_auth():
    client = make_client()
    res = client.post('/api/sensitivity/calibrations', json=VALID_CALIBRATION)
    assert res.status_code == 401


@patch('routes.sensitivity.save_sens_calibration')
def test_submit_calibration_degrades_gracefully_when_migration_not_applied(mock_save):
    mock_save.side_effect = Exception('relation "sens_calibrations" does not exist')
    client = make_client()

    res = client.post('/api/sensitivity/calibrations', json=VALID_CALIBRATION, headers=auth_headers())

    assert res.status_code == 503


# ── GET /sensitivity/calibrations ────────────────────────────────────────────

@patch('routes.sensitivity.get_sens_calibrations')
def test_list_calibrations_returns_history(mock_get):
    mock_get.return_value = [{'id': 1, **VALID_CALIBRATION, 'applied': False}]
    client = make_client()

    res = client.get('/api/sensitivity/calibrations', headers=auth_headers())

    assert res.status_code == 200
    mock_get.assert_called_once_with(7)


@patch('routes.sensitivity.get_sens_calibrations')
def test_list_calibrations_degrades_gracefully_when_migration_not_applied(mock_get):
    mock_get.side_effect = Exception('relation "sens_calibrations" does not exist')
    client = make_client()

    res = client.get('/api/sensitivity/calibrations', headers=auth_headers())

    assert res.status_code == 503


def test_list_calibrations_requires_auth():
    client = make_client()
    res = client.get('/api/sensitivity/calibrations')
    assert res.status_code == 401


# ── PATCH /sensitivity/calibrations/<id>/applied ─────────────────────────────

@patch('routes.sensitivity.mark_sens_calibration_applied')
def test_apply_calibration_marks_applied(mock_mark):
    mock_mark.return_value = {'id': 1, 'applied': True}
    client = make_client()

    res = client.patch('/api/sensitivity/calibrations/1/applied', headers=auth_headers())

    assert res.status_code == 200
    mock_mark.assert_called_once_with(7, 1)


@patch('routes.sensitivity.mark_sens_calibration_applied')
def test_apply_calibration_404_when_not_found(mock_mark):
    mock_mark.return_value = None
    client = make_client()

    res = client.patch('/api/sensitivity/calibrations/999/applied', headers=auth_headers())

    assert res.status_code == 404


@patch('routes.sensitivity.mark_sens_calibration_applied')
def test_apply_calibration_degrades_gracefully_when_migration_not_applied(mock_mark):
    mock_mark.side_effect = Exception('relation "sens_calibrations" does not exist')
    client = make_client()

    res = client.patch('/api/sensitivity/calibrations/1/applied', headers=auth_headers())

    assert res.status_code == 503


def test_apply_calibration_requires_auth():
    client = make_client()
    res = client.patch('/api/sensitivity/calibrations/1/applied')
    assert res.status_code == 401
