import os
import sys
import json
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.questionnaire as questionnaire_routes
from routes.questionnaire import _as_list
from utils import create_access_token
import database


def make_client():
    app = Flask(__name__)
    app.register_blueprint(questionnaire_routes.questionnaire_bp, url_prefix='/api')
    return app.test_client()


def auth_headers(user_id=7):
    return {'Authorization': f'Bearer {create_access_token(user_id)}'}


VALID_PAYLOAD = {
    'name': 'Jogador', 'focus_area': ['aim', 'reflex'], 'experience_level': 'intermediario',
    'aim_difficulty': ['tracking', 'flick'], 'reflex_level': 'medio', 'movement_quality': 'moderado',
    'daily_time': 45, 'specific_weakness': ['moving_target'],
}


# ── _as_list (SPEC-004 normalization) ────────────────────────────────────────

def test_as_list_passes_through_a_list_deduped_and_capped_at_2():
    assert _as_list(['aim', 'reflex'], 'aim') == ['aim', 'reflex']
    assert _as_list(['aim', 'aim', 'reflex', 'movement'], 'aim') == ['aim', 'reflex']


def test_as_list_wraps_a_bare_scalar():
    assert _as_list('aim', 'aim') == ['aim']


def test_as_list_falls_back_to_default_when_missing_or_empty():
    assert _as_list(None, 'aim') == ['aim']
    assert _as_list([], 'aim') == ['aim']
    assert _as_list(None, '') == []
    assert _as_list('', '') == []


def test_as_list_drops_blank_entries():
    assert _as_list(['aim', '', None, 'reflex'], 'aim') == ['aim', 'reflex']


# ── POST /questionnaire — route ──────────────────────────────────────────────

def test_submit_accepts_array_payload_for_the_3_multiselect_fields():
    with patch('routes.questionnaire.save_questionnaire') as mock_save, \
         patch('routes.questionnaire.resolve_action_level', return_value=(1, '')), \
         patch('routes.questionnaire.generate_routine', return_value={'focus_area': 'aim'}), \
         patch('routes.questionnaire.create_training_session', return_value=99), \
         patch('routes.questionnaire.get_user_by_id', return_value={'id': 7, 'name': 'Jogador'}):
        client = make_client()
        res = client.post('/api/questionnaire', json=VALID_PAYLOAD, headers=auth_headers())

        assert res.status_code == 201
        profile = mock_save.call_args[0][1]
        assert profile['focus_area'] == ['aim', 'reflex']
        assert profile['aim_difficulty'] == ['tracking', 'flick']
        assert profile['specific_weakness'] == ['moving_target']


def test_submit_accepts_bare_scalar_payload_for_the_3_multiselect_fields():
    # An older/desktop client that hasn't picked up the multi-select UI yet
    # still sends a plain string — must keep working (SPEC-004 edge case).
    payload = dict(VALID_PAYLOAD, focus_area='aim', aim_difficulty='tracking', specific_weakness='headshot')
    with patch('routes.questionnaire.save_questionnaire') as mock_save, \
         patch('routes.questionnaire.resolve_action_level', return_value=(1, '')), \
         patch('routes.questionnaire.generate_routine', return_value={'focus_area': 'aim'}), \
         patch('routes.questionnaire.create_training_session', return_value=99), \
         patch('routes.questionnaire.get_user_by_id', return_value={'id': 7, 'name': 'Jogador'}):
        client = make_client()
        res = client.post('/api/questionnaire', json=payload, headers=auth_headers())

        assert res.status_code == 201
        profile = mock_save.call_args[0][1]
        assert profile['focus_area'] == ['aim']
        assert profile['aim_difficulty'] == ['tracking']
        assert profile['specific_weakness'] == ['headshot']


def test_submit_requires_auth():
    client = make_client()
    res = client.post('/api/questionnaire', json=VALID_PAYLOAD)
    assert res.status_code == 401


# ── database.save_questionnaire — legacy column + *_multi fallback ─────────

def test_save_questionnaire_writes_first_choice_to_legacy_columns():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{'id': 1}])
    with patch('database.get_supabase', return_value=mock_sb):
        database.save_questionnaire(7, {
            'focus_area': ['aim', 'reflex'], 'aim_difficulty': ['tracking', 'flick'],
            'specific_weakness': ['moving_target'], 'experience_level': 'intermediario',
            'reflex_level': 'medio', 'movement_quality': 'moderado', 'daily_time': 45,
        })

    row = mock_sb.table.return_value.insert.call_args[0][0]
    assert row['focus_area'] == 'aim'            # first choice only
    assert row['aim_difficulty'] == 'tracking'    # first choice only
    assert row['specific_weakness'] == 'moving_target'
    assert json.loads(row['focus_area_multi']) == ['aim', 'reflex']
    assert json.loads(row['aim_difficulty_multi']) == ['tracking', 'flick']
    assert json.loads(row['specific_weakness_multi']) == ['moving_target']


def test_save_questionnaire_falls_back_to_legacy_insert_when_multi_columns_are_missing():
    mock_sb = MagicMock()
    first_insert = MagicMock()
    first_insert.execute.side_effect = Exception('column "focus_area_multi" does not exist')
    second_insert = MagicMock()
    second_insert.execute.return_value = MagicMock(data=[{'id': 1}])
    mock_sb.table.return_value.insert.side_effect = [first_insert, second_insert]

    with patch('database.get_supabase', return_value=mock_sb):
        database.save_questionnaire(7, {
            'focus_area': ['aim', 'reflex'], 'aim_difficulty': ['tracking', 'flick'],
            'specific_weakness': [], 'experience_level': 'intermediario',
        })

    assert mock_sb.table.return_value.insert.call_count == 2
    fallback_row = mock_sb.table.return_value.insert.call_args_list[1][0][0]
    assert 'focus_area_multi' not in fallback_row
    assert fallback_row['focus_area'] == 'aim'
    assert fallback_row['aim_difficulty'] == 'tracking'


# ── database.get_latest_questionnaire — legacy profile reads as a 1-item list ─

def test_get_latest_questionnaire_reads_legacy_row_as_single_item_list():
    # Old row: *_multi columns don't exist at all in the select('*') result.
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = \
        MagicMock(data=[{'id': 1, 'user_id': 7, 'focus_area': 'aim', 'aim_difficulty': 'tracking', 'specific_weakness': ''}])

    with patch('database.get_supabase', return_value=mock_sb):
        profile = database.get_latest_questionnaire(7)

    assert profile['focus_area'] == ['aim']
    assert profile['aim_difficulty'] == ['tracking']
    assert profile['specific_weakness'] == []  # empty legacy value -> empty list, not ['']


def test_get_latest_questionnaire_reads_new_row_as_full_array():
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = \
        MagicMock(data=[{
            'id': 1, 'user_id': 7, 'focus_area': 'aim', 'focus_area_multi': json.dumps(['aim', 'reflex']),
            'aim_difficulty': 'tracking', 'aim_difficulty_multi': json.dumps(['tracking', 'flick']),
            'specific_weakness': 'moving_target', 'specific_weakness_multi': json.dumps(['moving_target']),
        }])

    with patch('database.get_supabase', return_value=mock_sb):
        profile = database.get_latest_questionnaire(7)

    assert profile['focus_area'] == ['aim', 'reflex']
    assert profile['aim_difficulty'] == ['tracking', 'flick']
    assert profile['specific_weakness'] == ['moving_target']


def test_get_latest_questionnaire_returns_none_when_no_row():
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = \
        MagicMock(data=[])
    with patch('database.get_supabase', return_value=mock_sb):
        assert database.get_latest_questionnaire(7) is None


# ── database.list_questionnaire_history / get_questionnaire_by_id (SPEC-006) ──

def test_list_questionnaire_history_returns_rows_and_total_normalized():
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value = \
        MagicMock(data=[
            {'id': 2, 'user_id': 7, 'focus_area': 'aim', 'focus_area_multi': json.dumps(['aim', 'reflex']),
             'aim_difficulty': 'tracking', 'specific_weakness': ''},
            {'id': 1, 'user_id': 7, 'focus_area': 'movement', 'aim_difficulty': '', 'specific_weakness': ''},
        ], count=2)

    with patch('database.get_supabase', return_value=mock_sb):
        rows, total = database.list_questionnaire_history(7, limit=10, offset=0)

    assert total == 2
    assert rows[0]['focus_area'] == ['aim', 'reflex']  # new-format row uses the full array
    assert rows[1]['focus_area'] == ['movement']       # legacy row falls back to a 1-item list


def test_get_questionnaire_by_id_scopes_by_user_id_in_the_query():
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = \
        MagicMock(data=[{'id': 5, 'user_id': 7, 'focus_area': 'aim', 'aim_difficulty': 'tracking', 'specific_weakness': ''}])

    with patch('database.get_supabase', return_value=mock_sb):
        profile = database.get_questionnaire_by_id(7, 5)

    assert profile['focus_area'] == ['aim']
    # both .eq() calls happened — id AND user_id are both query filters
    assert mock_sb.table.return_value.select.return_value.eq.call_args_list[0].args == ('id', 5)
    assert mock_sb.table.return_value.select.return_value.eq.return_value.eq.call_args_list[0].args == ('user_id', 7)


def test_get_questionnaire_by_id_returns_none_when_no_matching_row():
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = \
        MagicMock(data=[])
    with patch('database.get_supabase', return_value=mock_sb):
        assert database.get_questionnaire_by_id(7, 999) is None


# ── GET /questionnaire/history — route ───────────────────────────────────────

HISTORY_ROW = {
    'id': 3, 'created_at': '2026-07-01T00:00:00', 'focus_area': ['aim'],
    'aim_difficulty': ['tracking'], 'specific_weakness': [], 'experience_level': 'intermediario',
    'daily_time': 45,
}
PREVIEW_ROUTINE = {
    'total_duration': 60,
    'sections': [
        {'name': 'aquecimento', 'exercises': [{'exercise': 'tracking_suave'}]},
        {'name': 'treino_principal', 'exercises': [{'exercise': 'tracking_suave'}, {'exercise': 'quick_flick'}]},
        {'name': 'aplicacao_jogo', 'exercises': [{'exercise': 'match_1'}]},
    ],
}


def test_get_history_paginates_and_attaches_a_preview():
    with patch('routes.questionnaire.list_questionnaire_history', return_value=([HISTORY_ROW], 1)) as mock_list, \
         patch('routes.questionnaire.generate_routine', return_value=PREVIEW_ROUTINE):
        client = make_client()
        res = client.get('/api/questionnaire/history?page=1&page_size=10', headers=auth_headers())

        assert res.status_code == 200
        body = res.get_json()
        assert body['total'] == 1
        assert body['page'] == 1
        assert body['page_size'] == 10
        assert body['items'][0]['preview'] == {
            'warmup_drill': 'tracking_suave',
            'main_drills': ['tracking_suave', 'quick_flick'],
            'match_count': 1,
            'total_duration': 60,
        }
        mock_list.assert_called_once_with(7, limit=10, offset=0)


def test_get_history_computes_offset_from_page():
    with patch('routes.questionnaire.list_questionnaire_history', return_value=([], 0)) as mock_list, \
         patch('routes.questionnaire.generate_routine', return_value=PREVIEW_ROUTINE):
        client = make_client()
        client.get('/api/questionnaire/history?page=3&page_size=10', headers=auth_headers())
        mock_list.assert_called_once_with(7, limit=10, offset=20)


def test_get_history_requires_auth():
    client = make_client()
    res = client.get('/api/questionnaire/history')
    assert res.status_code == 401


# ── POST /questionnaire/history/<id>/reactivate — route ──────────────────────

def test_reactivate_returns_404_for_a_profile_belonging_to_someone_else_or_missing():
    with patch('routes.questionnaire.get_questionnaire_by_id', return_value=None) as mock_get, \
         patch('routes.questionnaire.save_questionnaire') as mock_save:
        client = make_client()
        res = client.post('/api/questionnaire/history/999/reactivate', headers=auth_headers())

        assert res.status_code == 404
        mock_get.assert_called_once_with(7, 999)
        mock_save.assert_not_called()


def test_reactivate_snapshots_the_chosen_profile_and_regenerates_the_routine():
    old_profile = dict(HISTORY_ROW, id=3)
    with patch('routes.questionnaire.get_questionnaire_by_id', return_value=old_profile), \
         patch('routes.questionnaire.save_questionnaire') as mock_save, \
         patch('routes.questionnaire.resolve_action_level', return_value=(2, '')), \
         patch('routes.questionnaire.generate_routine', return_value=PREVIEW_ROUTINE) as mock_generate, \
         patch('routes.questionnaire.create_training_session', return_value=123) as mock_create, \
         patch('routes.questionnaire.get_user_by_id', return_value={'id': 7, 'name': 'Jogador'}):
        client = make_client()
        res = client.post('/api/questionnaire/history/3/reactivate', headers=auth_headers())

        assert res.status_code == 201
        body = res.get_json()
        assert body['session_id'] == 123
        assert body['routine'] == PREVIEW_ROUTINE
        # save_questionnaire writes a NEW row from the OLD profile's answers —
        # never mutates/references the old row's id.
        mock_save.assert_called_once_with(7, old_profile)
        mock_generate.assert_called_once()
        mock_create.assert_called_once()


def test_reactivate_requires_auth():
    client = make_client()
    res = client.post('/api/questionnaire/history/3/reactivate')
    assert res.status_code == 401
