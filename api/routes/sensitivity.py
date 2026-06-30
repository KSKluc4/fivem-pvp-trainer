import traceback
from flask import Blueprint, request, jsonify, g
from utils import require_auth
from database import save_sensitivity_conversion, get_sensitivity_history

sensitivity_bp = Blueprint('sensitivity', __name__)

# Community-validated yaw values (degrees/count per sensitivity unit)
# Source: mouse-sensitivity.com — verified against community posts on r/FPSAimTrainer
GTA_YAW    = 0.009   # GTA V, sensitivity scale 0–10
KOVAAK_YAW = 0.022   # KovaaK's FPS Aim Trainer
AIMLAB_YAW = 0.022   # Aim Lab (same effective yaw as KovaaK's)


def _do_convert(gta_sens: float, dpi: int) -> dict:
    abs_sens = abs(gta_sens)
    cm_360   = (360 / (dpi * abs_sens * GTA_YAW)) * 2.54
    # target_sens = 360*2.54 / (dpi * target_yaw * cm_360)
    kovaak = (360 * 2.54) / (dpi * KOVAAK_YAW * cm_360)
    aimlab = (360 * 2.54) / (dpi * AIMLAB_YAW * cm_360)
    return {
        'cm_per_360':        round(cm_360, 4),
        'kovaak_sensitivity': round(kovaak, 4),
        'aimlab_sensitivity': round(aimlab, 4),
        'inverted':          gta_sens < 0,
        'gta_sensitivity':   gta_sens,
        'dpi':               dpi,
    }


@sensitivity_bp.route('/sensitivity/convert', methods=['POST'])
@require_auth
def convert_sensitivity():
    data = request.get_json() or {}

    gta_sens_raw = data.get('gta_sensitivity')
    dpi_raw      = data.get('dpi')

    # Validation
    try:
        gta_sens = float(gta_sens_raw)
    except (TypeError, ValueError):
        return jsonify({'error': 'Sensibilidade do GTA V inválida.'}), 400

    if gta_sens == 0:
        return jsonify({'error': 'Sensibilidade não pode ser zero (resultaria em rotação infinita).'}), 400

    try:
        dpi = int(dpi_raw)
    except (TypeError, ValueError):
        return jsonify({'error': 'DPI inválido.'}), 400

    if dpi <= 0:
        return jsonify({'error': 'DPI deve ser um número positivo.'}), 400

    result = _do_convert(gta_sens, dpi)

    # Persist to history (best-effort — graceful if table doesn't exist yet)
    try:
        save_sensitivity_conversion(
            user_id  = g.user_id,
            gta_sens = gta_sens,
            dpi      = dpi,
            cm_360   = result['cm_per_360'],
            kovaak   = result['kovaak_sensitivity'],
            aimlab   = result['aimlab_sensitivity'],
            inverted = 1 if result['inverted'] else 0,
        )
    except Exception:
        traceback.print_exc()  # log but don't fail the response

    return jsonify(result), 200


@sensitivity_bp.route('/sensitivity/history', methods=['GET'])
@require_auth
def sensitivity_history():
    try:
        rows = get_sensitivity_history(g.user_id)
        return jsonify(rows), 200
    except Exception as exc:
        traceback.print_exc()
        return jsonify({'error': str(exc)}), 500
