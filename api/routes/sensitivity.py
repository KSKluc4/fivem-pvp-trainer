import math
import traceback
from flask import Blueprint, request, jsonify, g
from utils import require_auth
from database import (
    update_user_sensitivity,
    save_sens_calibration, get_sens_calibrations, mark_sens_calibration_applied,
)

sensitivity_bp = Blueprint('sensitivity', __name__)

VALID_VERDICTS = {'aumentar', 'diminuir', 'manter', 'inconclusivo'}


class _ValidationError(Exception):
    """Raised by the _parse_* helpers below — caught once at each route's
    top level and turned into a 400. Keeps update_sensitivity() and
    submit_sens_calibration() sharing the exact same finiteness/range rules
    (both accept a GTA sensitivity value) without duplicating the checks."""


def _parse_gta_sens(value, field_label='Sensibilidade do GTA V'):
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise _ValidationError(f'{field_label} inválida.')
    if not math.isfinite(v) or abs(v) > 100:
        raise _ValidationError(f'{field_label} deve estar entre -100 e 100.')
    return v


def _parse_dpi(value, field_label='DPI'):
    # Finiteness is checked via a float() pre-check (rather than int()
    # itself) purely to turn `int(float('inf'))`'s OverflowError into the
    # same clean _ValidationError as every other bad-input case below —
    # the actual int() conversion afterwards still runs on the ORIGINAL
    # value, so a non-integer numeric string ("800.5") is still rejected
    # exactly as before, not silently truncated.
    try:
        finite_check = float(value)
    except (TypeError, ValueError):
        raise _ValidationError(f'{field_label} inválido.')
    if not math.isfinite(finite_check):
        raise _ValidationError(f'{field_label} deve ser um número positivo.')
    try:
        v = int(value)
    except (TypeError, ValueError):
        raise _ValidationError(f'{field_label} inválido.')
    if v <= 0:
        raise _ValidationError(f'{field_label} deve ser um número positivo.')
    return v


def _optional_finite_float(data, key, field_label):
    """Same leniency as before for a field that's simply missing/not a
    number (returns None, doesn't fail the request) — but a value that DOES
    parse must be finite, closing the same Infinity/NaN-breaks-JSON hole for
    the optional metrics as for sens_at_test/dpi_at_test."""
    value = data.get(key)
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        raise _ValidationError(f'{field_label} inválido.')
    return v

# Community-validated yaw value (degrees/count per sensitivity unit).
# Source: mouse-sensitivity.com — verified against community posts on
# r/FPSAimTrainer. This is the only conversion this app ever needs now — the
# in-app trainer replaces third-party tools entirely, so there's no more
# KovaaK's/Aim Lab yaw to convert to.
GTA_YAW = 0.0009  # GTA V, sensitivity scale 0–100 (in-game slider)

# The -100..+100 slider is a single continuous SPEED dial, not a
# magnitude+axis-invert pair — negative values are genuinely slower turning,
# never an inverted Y axis. Mirrors src/frontend/src/services/sensitivityMath.js
# exactly (keep both in sync when recalibrating) — see that file for the
# full derivation of these constants from the two anchor points:
#   - sens=50 must still read 25.4cm/360 @ 800 dpi (community-validated).
#   - sens=-100 (slowest extreme) lands on a small-but-positive floor so
#     cm/360 never degenerates to infinity anywhere in the domain.
SENS_SLOPE = 0.3
SENS_BASE  = 35.0


def _effective_magnitude(gta_sens: float) -> float:
    return SENS_BASE + SENS_SLOPE * gta_sens


def _cm_per_360(gta_sens: float, dpi: int) -> float:
    magnitude = _effective_magnitude(gta_sens)
    return (360 / (dpi * magnitude * GTA_YAW)) * 2.54


@sensitivity_bp.route('/sensitivity', methods=['PUT'])
@require_auth
def update_sensitivity():
    """Single source of truth for the user's sensitivity — read/written by
    both the "Minha Sensibilidade" screen and the in-app trainer's own setup
    flow. `fine_tune_multiplier` is optional (trainer-only refinement); when
    omitted, whatever value is already saved is left untouched."""
    data = request.get_json() or {}

    try:
        gta_sens = _parse_gta_sens(data.get('gta_sensitivity'))
        dpi = _parse_dpi(data.get('dpi'))
    except _ValidationError as exc:
        return jsonify({'error': str(exc)}), 400

    fine_tune = None
    if 'fine_tune_multiplier' in data:
        try:
            fine_tune = float(data['fine_tune_multiplier'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Ajuste fino inválido.'}), 400
        if not (0.5 <= fine_tune <= 1.5):
            return jsonify({'error': 'Ajuste fino deve estar entre 0.5 e 1.5.'}), 400

    try:
        updated = update_user_sensitivity(g.user_id, gta_sens, dpi, fine_tune)
    except Exception:
        return jsonify({'error': 'Sensibilidade indisponível no momento. Tente novamente mais tarde.'}), 503
    if not updated:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    return jsonify({
        'gta_sensitivity':      updated.get('gta_sensitivity'),
        'dpi':                  updated.get('dpi'),
        'fine_tune_multiplier': updated.get('fine_tune_multiplier') if updated.get('fine_tune_multiplier') is not None else 1.0,
        'cm_per_360':           round(_cm_per_360(gta_sens, dpi), 4),
    })


# ── Sensitivity discovery test — calibration history (migration v11) ────────
#
# The sens_calibrations table may not exist yet on a freshly-deployed backend
# (the SQL is applied manually, after deploy) — every handler below degrades
# gracefully instead of 500ing: POST/PATCH return 503 with a clear message,
# GET returns an empty list, exactly like /trainer/scores already does for
# the same reason.

@sensitivity_bp.route('/sensitivity/calibrations', methods=['POST'])
@require_auth
def submit_sens_calibration():
    data = request.get_json() or {}

    try:
        sens_at_test = _parse_gta_sens(data.get('sens_at_test'), 'sens_at_test')
        dpi_at_test = _parse_dpi(data.get('dpi_at_test'), 'dpi_at_test')

        verdict = str(data.get('verdict', '')).strip()
        if verdict not in VALID_VERDICTS:
            raise _ValidationError('verdict inválido.')

        payload = {
            'sens_at_test':       sens_at_test,
            'dpi_at_test':        dpi_at_test,
            'verdict':            verdict,
            'flick_ratio_median': _optional_finite_float(data, 'flick_ratio_median', 'flick_ratio_median'),
            'overshoot_rate':     _optional_finite_float(data, 'overshoot_rate', 'overshoot_rate'),
            'tracking_error':     _optional_finite_float(data, 'tracking_error', 'tracking_error'),
            'suggested_sens':     _optional_finite_float(data, 'suggested_sens', 'suggested_sens'),
        }
    except _ValidationError as exc:
        return jsonify({'error': str(exc)}), 400

    try:
        row = save_sens_calibration(g.user_id, payload)
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Não foi possível salvar o resultado agora — o histórico pode ainda não estar disponível.'}), 503

    return jsonify(row), 201


@sensitivity_bp.route('/sensitivity/calibrations', methods=['GET'])
@require_auth
def list_sens_calibrations():
    try:
        rows = get_sens_calibrations(g.user_id)
        return jsonify(rows), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Histórico de calibração indisponível no momento.'}), 503


@sensitivity_bp.route('/sensitivity/calibrations/<int:calibration_id>/applied', methods=['PATCH'])
@require_auth
def apply_sens_calibration(calibration_id):
    try:
        updated = mark_sens_calibration_applied(g.user_id, calibration_id)
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Histórico de calibração indisponível no momento.'}), 503
    if not updated:
        return jsonify({'error': 'Calibração não encontrada.'}), 404
    return jsonify(updated), 200
