from flask import Blueprint, request, jsonify, g
from utils import require_auth
from database import update_user_sensitivity

sensitivity_bp = Blueprint('sensitivity', __name__)

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
        gta_sens = float(data.get('gta_sensitivity'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Sensibilidade do GTA V inválida.'}), 400
    if abs(gta_sens) > 100:
        return jsonify({'error': 'Sensibilidade do GTA V deve estar entre -100 e 100.'}), 400

    try:
        dpi = int(data.get('dpi'))
    except (TypeError, ValueError):
        return jsonify({'error': 'DPI inválido.'}), 400
    if dpi <= 0:
        return jsonify({'error': 'DPI deve ser um número positivo.'}), 400

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
