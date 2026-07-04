import traceback
from flask import Blueprint, request, jsonify, g
from database import save_trainer_score, get_trainer_scores
from utils import require_auth

trainer_bp = Blueprint('trainer', __name__)

MAX_SCORE      = 10_000_000  # sanity ceiling — well above any real 60s session
MAX_DURATION_S = 3600


@trainer_bp.route('/trainer/scores', methods=['POST'])
@require_auth
def submit_trainer_score():
    data = request.get_json() or {}

    exercise   = str(data.get('exercise', '')).strip()
    difficulty = str(data.get('difficulty', '')).strip()

    if not exercise or not difficulty:
        return jsonify({'error': 'exercise e difficulty são obrigatórios.'}), 400

    try:
        score = int(data.get('score'))
        accuracy = float(data.get('accuracy'))
        duration_s = int(data.get('duration_s'))
    except (TypeError, ValueError):
        return jsonify({'error': 'score, accuracy e duration_s devem ser numéricos.'}), 400

    if not (0 <= score <= MAX_SCORE):
        return jsonify({'error': 'score fora do intervalo esperado.'}), 400
    if not (0 <= accuracy <= 100):
        return jsonify({'error': 'accuracy deve estar entre 0 e 100.'}), 400
    if not (0 < duration_s <= MAX_DURATION_S):
        return jsonify({'error': 'duration_s fora do intervalo esperado.'}), 400

    try:
        row = save_trainer_score(g.user_id, exercise, difficulty, score, accuracy, duration_s)
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Não foi possível salvar o score agora.'}), 503

    return jsonify(row), 201


@trainer_bp.route('/trainer/scores', methods=['GET'])
@require_auth
def list_trainer_scores():
    exercise = request.args.get('exercise')
    try:
        rows = get_trainer_scores(g.user_id, exercise)
        return jsonify(rows), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Scores indisponíveis no momento.'}), 503
