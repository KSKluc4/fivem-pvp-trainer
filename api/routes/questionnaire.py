from datetime import date
from flask import Blueprint, request, jsonify, g
from database import (
    get_user_by_id, save_questionnaire, create_training_session,
    list_questionnaire_history, get_questionnaire_by_id, get_latest_questionnaire,
)
from services.routine_generator import generate_routine
from services.level_service import resolve_action_level
from services.aim_level import compute_per_category_levels, resolve_aim_accelerator
from utils import require_auth

questionnaire_bp = Blueprint('questionnaire', __name__)

DEFAULT_HISTORY_PAGE_SIZE = 10
MAX_HISTORY_PAGE_SIZE = 50

# specific_weakness/focus_area/aim_difficulty support up to 2 selections
# (SPEC-004) — the UI already caps at 2, this is a defensive server-side
# normalization for any payload that reaches this endpoint some other way.
# From here on, profile[these 3 keys] is ALWAYS a list of 1-2 non-empty
# strings — save_questionnaire/generate_routine only ever see lists for them.


def _as_list(value, default):
    if isinstance(value, list):
        items = [str(v).strip() for v in value if v and str(v).strip()]
    elif value:
        items = [str(value).strip()]
    else:
        items = []
    items = list(dict.fromkeys(items))[:2]  # dedupe, cap at 2
    return items or ([default] if default else [])


def _build_profile_from_payload(data):
    return {
        'focus_area':        _as_list(data.get('focus_area'), 'aim'),
        'experience_level':  data.get('experience_level', 'iniciante'),
        'aim_difficulty':    _as_list(data.get('aim_difficulty'), ''),
        'reflex_level':      data.get('reflex_level', ''),
        'movement_quality':  data.get('movement_quality', ''),
        'daily_time':        int(data.get('daily_time', 30)),
        'preferred_tool':    data.get('preferred_tool', 'aimlab'),
        'main_weapon':       data.get('main_weapon', ''),
        'specific_weakness': _as_list(data.get('specific_weakness'), ''),
    }


def _activate_profile(user_id, profile, aim_levels=None, aim_accelerated=False):
    """Persists `profile` as the user's new active questionnaire answer,
    resolves the mata-mata level, generates today's routine from it, and
    starts a fresh training_sessions row for today. Shared by a fresh
    questionnaire submission, SPEC-006's "reactivate a past profile", and
    the "change my focus" shortcut — a raw questionnaire_results row (after
    database._normalize_multi_fields) already carries every key this needs
    under the same names, so all three callers can hand it straight to this
    function without adapting it.

    aim_levels/aim_accelerated are optional and default to the same "no aim
    data" behavior submit/reactivate always had (aim-block difficulty falls
    back to 'medio') — only the focus shortcut passes the user's real
    current per-category levels, since that's the one caller where skipping
    them would visibly downgrade an established player's drills back to
    medio on every focus change."""
    save_questionnaire(user_id, profile)
    action_level, action_level_note = resolve_action_level(user_id, profile)
    routine    = generate_routine(profile, action_level=action_level, action_level_note=action_level_note,
                                   aim_levels=aim_levels, aim_accelerated=aim_accelerated)
    session_id = create_training_session(user_id, date.today().isoformat(), routine)

    user = get_user_by_id(user_id)
    name = user['name'] if user else 'Jogador'

    return {
        'user_id':    user_id,
        'session_id': session_id,
        'name':       name,
        'routine':    routine,
    }


def _routine_preview(profile):
    """A cheap, structural preview of what `profile` would generate — SPEC-006's
    history list shows this per past profile. generate_routine is pure (no
    I/O), so computing it once per list item is safe. aim_levels/action_level
    are deliberately left at their defaults (medium difficulty, experience-
    based level) rather than the user's real current values — see SPEC-006
    'Pontos a confirmar' #1."""
    routine = generate_routine(profile, today=date.today())
    warmup = next((s for s in routine['sections'] if s['name'] == 'aquecimento'), None)
    main   = next((s for s in routine['sections'] if s['name'] == 'treino_principal'), None)
    match  = next((s for s in routine['sections'] if s['name'] == 'aplicacao_jogo'), None)
    return {
        'warmup_drill':   (warmup['exercises'][0]['exercise'] if warmup and warmup['exercises'] else None),
        'main_drills':    [ex['exercise'] for ex in (main['exercises'] if main else [])],
        'match_count':    len(match['exercises']) if match else 0,
        'total_duration': routine['total_duration'],
    }


@questionnaire_bp.route('/questionnaire', methods=['POST'])
@require_auth
def submit_questionnaire():
    data = request.get_json() or {}
    profile = _build_profile_from_payload(data)
    return jsonify(_activate_profile(g.user_id, profile)), 201


@questionnaire_bp.route('/questionnaire/history', methods=['GET'])
@require_auth
def get_questionnaire_history():
    try:
        page      = max(1, int(request.args.get('page', 1)))
        page_size = max(1, min(MAX_HISTORY_PAGE_SIZE, int(request.args.get('page_size', DEFAULT_HISTORY_PAGE_SIZE))))
    except (TypeError, ValueError):
        return jsonify({'error': 'page/page_size inválidos.'}), 400

    offset = (page - 1) * page_size
    rows, total = list_questionnaire_history(g.user_id, limit=page_size, offset=offset)
    items = [{**row, 'preview': _routine_preview(row)} for row in rows]

    return jsonify({'items': items, 'total': total, 'page': page, 'page_size': page_size})


@questionnaire_bp.route('/questionnaire/history/<int:profile_id>/reactivate', methods=['POST'])
@require_auth
def reactivate_profile(profile_id):
    # get_questionnaire_by_id scopes by user_id in the query itself — a
    # profile_id belonging to someone else looks identical to "doesn't
    # exist" here, on purpose (never confirms whether the id exists at all).
    profile = get_questionnaire_by_id(g.user_id, profile_id)
    if profile is None:
        return jsonify({'error': 'Perfil não encontrado.'}), 404
    return jsonify(_activate_profile(g.user_id, profile)), 201


@questionnaire_bp.route('/questionnaire/current', methods=['GET'])
@require_auth
def get_current_questionnaire():
    """The user's active profile, normalized (list-shaped focus fields) —
    used by the "change my focus" shortcut to pre-fill its 3 questions with
    what's currently answered, without needing the full history list."""
    profile = get_latest_questionnaire(g.user_id)
    if profile is None:
        return jsonify({'error': 'Perfil não encontrado.'}), 404
    return jsonify(profile)


@questionnaire_bp.route('/questionnaire/focus', methods=['POST'])
@require_auth
def update_focus():
    """"Mudar meu foco" — updates ONLY specific_weakness/focus_area/
    aim_difficulty on a NEW snapshot of the user's current profile (every
    other answer — experience_level, reflex_level, movement_quality,
    daily_time, preferred_tool, main_weapon — carries over unchanged from
    get_latest_questionnaire), then regenerates today's routine from it.
    Same snapshot-and-regenerate shape as reactivate, except it also passes
    the user's real current aim levels (see _activate_profile's docstring)
    so the drills' difficulty doesn't drop back to 'medio' just because the
    focus changed."""
    data = request.get_json() or {}
    profile = get_latest_questionnaire(g.user_id)
    if profile is None:
        return jsonify({'error': 'Perfil não encontrado.'}), 404

    profile = dict(profile)
    profile['specific_weakness'] = _as_list(data.get('specific_weakness'), '')
    profile['focus_area']        = _as_list(data.get('focus_area'), 'aim')
    profile['aim_difficulty']    = _as_list(data.get('aim_difficulty'), '')

    # Best-effort, same pattern as training.py's GET — a Supabase hiccup
    # here must never block the focus change itself.
    try:
        aim_levels = compute_per_category_levels(g.user_id)
        aim_accelerated = resolve_aim_accelerator(g.user_id, aim_levels)
    except Exception:
        aim_levels, aim_accelerated = {}, False

    return jsonify(_activate_profile(g.user_id, profile, aim_levels=aim_levels, aim_accelerated=aim_accelerated)), 201
