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


def _cm_per_360(gta_sens: float, dpi: int) -> float:
    return (360 / (dpi * abs(gta_sens) * GTA_YAW)) * 2.54


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
    if gta_sens == 0:
        return jsonify({'error': 'Sensibilidade não pode ser zero (resultaria em rotação infinita).'}), 400
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
        'inverted':             gta_sens < 0,
    })
