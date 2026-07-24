import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask

import routes.progress as progress_routes
from utils import create_access_token
import database


def make_client():
    app = Flask(__name__)
    app.register_blueprint(progress_routes.progress_bp, url_prefix='/api')
    return app.test_client()


def auth_headers(user_id=7):
    return {'Authorization': f'Bearer {create_access_token(user_id)}'}


# ── GET /progress/<user_id>/action-level — route (SPEC-006) ─────────────────

def test_get_action_level_returns_the_summary():
    summary = {'level': 3, 'quota': 80, 'previous_level': 2, 'changed_at': '2026-07-01T00:00:00', 'direction': 'up'}
    with patch('routes.progress.get_action_level_summary', return_value=summary) as mock_get:
        client = make_client()
        res = client.get('/api/progress/7/action-level', headers=auth_headers())

        assert res.status_code == 200
        assert res.get_json() == summary
        mock_get.assert_called_once_with(7)


def test_get_action_level_returns_null_when_user_has_no_goal_level_yet():
    with patch('routes.progress.get_action_level_summary', return_value=None):
        client = make_client()
        res = client.get('/api/progress/7/action-level', headers=auth_headers())

        assert res.status_code == 200
        assert res.get_json() is None


def test_get_action_level_forbids_other_users():
    client = make_client()
    res = client.get('/api/progress/999/action-level', headers=auth_headers(user_id=7))
    assert res.status_code == 403


def test_get_action_level_requires_auth():
    client = make_client()
    res = client.get('/api/progress/7/action-level')
    assert res.status_code == 401


# ── GET /progress/<user_id>/heatmap — route (SPEC-006) ───────────────────────

def test_get_heatmap_returns_the_data_and_defaults_to_90_days():
    with patch('routes.progress.get_activity_heatmap', return_value=[]) as mock_get:
        client = make_client()
        res = client.get('/api/progress/7/heatmap', headers=auth_headers())

        assert res.status_code == 200
        mock_get.assert_called_once_with(7, days=90)


def test_get_heatmap_respects_the_days_query_param():
    with patch('routes.progress.get_activity_heatmap', return_value=[]) as mock_get:
        client = make_client()
        client.get('/api/progress/7/heatmap?days=30', headers=auth_headers())
        mock_get.assert_called_once_with(7, days=30)


def test_get_heatmap_forbids_other_users():
    client = make_client()
    res = client.get('/api/progress/999/heatmap', headers=auth_headers(user_id=7))
    assert res.status_code == 403


def test_get_heatmap_requires_auth():
    client = make_client()
    res = client.get('/api/progress/7/heatmap')
    assert res.status_code == 401


# ── database.get_activity_heatmap — the 3 states ─────────────────────────────

ROUTINE_2_CHECKABLE = {
    'sections': [
        {'name': 'aquecimento', 'checkable': False, 'exercises': [{'exercise': 'tracking_suave'}]},
        {'name': 'treino_principal', 'checkable': True, 'exercises': [{'exercise': 'tracking_suave'}, {'exercise': 'quick_flick'}]},
    ],
}


def _heatmap_sb(sessions, progress_rows):
    sb = MagicMock()
    sb.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value = \
        MagicMock(data=sessions)
    sb.table.return_value.select.return_value.in_.return_value.neq.return_value.execute.return_value = \
        MagicMock(data=progress_rows)
    return sb


def test_activity_heatmap_classifies_none_partial_complete():
    sessions = [
        {'id': 1, 'date': '2026-07-01', 'routine': ROUTINE_2_CHECKABLE, 'created_at': '2026-07-01T10:00:00'},
        {'id': 2, 'date': '2026-07-02', 'routine': ROUTINE_2_CHECKABLE, 'created_at': '2026-07-02T10:00:00'},
        {'id': 3, 'date': '2026-07-03', 'routine': ROUTINE_2_CHECKABLE, 'created_at': '2026-07-03T10:00:00'},
    ]
    # session 1: 0 done -> none. session 2: 1/2 done -> partial. session 3: 2/2 done -> complete.
    progress_rows = [
        {'session_id': 2}, {'session_id': 3}, {'session_id': 3},
    ]
    with patch('database.get_supabase', return_value=_heatmap_sb(sessions, progress_rows)):
        result = database.get_activity_heatmap(7, days=90)

    by_date = {r['date']: r for r in result}
    assert by_date['2026-07-01']['state'] == 'none'
    assert by_date['2026-07-02']['state'] == 'partial'
    assert by_date['2026-07-02']['exercises_done'] == 1
    assert by_date['2026-07-03']['state'] == 'complete'
    assert by_date['2026-07-03']['exercises_done'] == 2


def test_activity_heatmap_keeps_only_the_latest_session_per_date():
    # A profile reactivation (SPEC-006 Parte 1) creates a 2nd session for the
    # same day — only the newest (by created_at desc, matching the query
    # order) should be counted, never both.
    sessions = [
        {'id': 20, 'date': '2026-07-01', 'routine': ROUTINE_2_CHECKABLE, 'created_at': '2026-07-01T18:00:00'},
        {'id': 10, 'date': '2026-07-01', 'routine': ROUTINE_2_CHECKABLE, 'created_at': '2026-07-01T09:00:00'},
    ]
    progress_rows = [{'session_id': 10}, {'session_id': 10}]  # only the OLDER session has progress logged
    with patch('database.get_supabase', return_value=_heatmap_sb(sessions, progress_rows)):
        result = database.get_activity_heatmap(7, days=90)

    assert len(result) == 1
    # session 20 (the newest) is what's kept, and it has 0 progress rows -> none
    assert result[0]['state'] == 'none'


def test_activity_heatmap_treats_zero_checkable_exercises_as_none():
    sessions = [{'id': 1, 'date': '2026-07-01', 'routine': {'sections': []}, 'created_at': '2026-07-01T10:00:00'}]
    with patch('database.get_supabase', return_value=_heatmap_sb(sessions, [])):
        result = database.get_activity_heatmap(7, days=90)
    assert result[0]['state'] == 'none'
    assert result[0]['exercises_total'] == 0


def test_activity_heatmap_returns_empty_list_when_no_sessions():
    with patch('database.get_supabase', return_value=_heatmap_sb([], [])):
        result = database.get_activity_heatmap(7, days=90)
    assert result == []


# ── database.get_action_level_summary ────────────────────────────────────────

def _goal_level_sb(row):
    sb = MagicMock()
    sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = \
        MagicMock(data=[row] if row else [])
    return sb


def test_action_level_summary_returns_none_when_no_row():
    with patch('database.get_supabase', return_value=_goal_level_sb(None)):
        assert database.get_action_level_summary(7) is None


def test_action_level_summary_with_no_previous_level_has_no_direction():
    row = {'user_id': 7, 'category': 'action', 'current_level': 2, 'previous_level': None, 'updated_at': '2026-07-01T00:00:00'}
    with patch('database.get_supabase', return_value=_goal_level_sb(row)):
        summary = database.get_action_level_summary(7)

    assert summary['level'] == 2
    assert summary['quota'] == 60
    assert summary['direction'] is None
    assert summary['changed_at'] is None


def test_action_level_summary_derives_up_direction():
    row = {'user_id': 7, 'category': 'action', 'current_level': 3, 'previous_level': 2, 'updated_at': '2026-07-05T00:00:00'}
    with patch('database.get_supabase', return_value=_goal_level_sb(row)):
        summary = database.get_action_level_summary(7)

    assert summary['direction'] == 'up'
    assert summary['changed_at'] == '2026-07-05T00:00:00'


def test_action_level_summary_derives_down_direction():
    row = {'user_id': 7, 'category': 'action', 'current_level': 1, 'previous_level': 2, 'updated_at': '2026-07-05T00:00:00'}
    with patch('database.get_supabase', return_value=_goal_level_sb(row)):
        summary = database.get_action_level_summary(7)

    assert summary['direction'] == 'down'


def test_action_level_summary_tolerates_missing_previous_level_column():
    # migration v13 not applied yet — the column is simply absent from the row.
    row = {'user_id': 7, 'category': 'action', 'current_level': 2, 'updated_at': '2026-07-01T00:00:00'}
    with patch('database.get_supabase', return_value=_goal_level_sb(row)):
        summary = database.get_action_level_summary(7)

    assert summary['level'] == 2
    assert summary['direction'] is None


# ── database.upsert_goal_level — previous_level + graceful fallback ─────────

def test_upsert_goal_level_omits_previous_level_when_not_given():
    mock_sb = MagicMock()
    mock_sb.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[])
    with patch('database.get_supabase', return_value=mock_sb):
        database.upsert_goal_level(7, 'action', 2)

    payload = mock_sb.table.return_value.upsert.call_args[0][0]
    assert 'previous_level' not in payload
    assert payload['current_level'] == 2


def test_upsert_goal_level_includes_previous_level_when_given():
    mock_sb = MagicMock()
    mock_sb.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[])
    with patch('database.get_supabase', return_value=mock_sb):
        database.upsert_goal_level(7, 'action', 3, previous_level=2)

    payload = mock_sb.table.return_value.upsert.call_args[0][0]
    assert payload['previous_level'] == 2
    assert payload['current_level'] == 3


def test_upsert_goal_level_falls_back_when_previous_level_column_is_missing():
    mock_sb = MagicMock()
    first_upsert = MagicMock()
    first_upsert.execute.side_effect = Exception('column "previous_level" does not exist')
    second_upsert = MagicMock()
    second_upsert.execute.return_value = MagicMock(data=[])
    mock_sb.table.return_value.upsert.side_effect = [first_upsert, second_upsert]

    with patch('database.get_supabase', return_value=mock_sb):
        database.upsert_goal_level(7, 'action', 3, previous_level=2)

    assert mock_sb.table.return_value.upsert.call_count == 2
    fallback_payload = mock_sb.table.return_value.upsert.call_args_list[1][0][0]
    assert 'previous_level' not in fallback_payload
    assert fallback_payload['current_level'] == 3
