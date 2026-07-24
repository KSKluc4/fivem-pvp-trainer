import os
import sys
import json
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import database

# SPEC-004 acceptance criterion 11: admin stats must keep reading only the
# legacy scalar focus_area column (get_admin_stats' select() never asks for
# focus_area_multi/aim_difficulty_multi/specific_weakness_multi), unaffected
# by rows that now also carry those columns.


def _admin_stats_sb(quest_rows):
    def table_side_effect(name):
        m = MagicMock()
        if name == 'users':
            m.select.return_value.execute.return_value = MagicMock(data=[])
        elif name == 'training_sessions':
            m.select.return_value.gte.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        elif name == 'questionnaire_results':
            m.select.return_value.execute.return_value = MagicMock(data=quest_rows)
        return m
    sb = MagicMock()
    sb.table.side_effect = table_side_effect
    return sb


def test_admin_stats_focus_distribution_reads_only_the_scalar_column():
    quest_rows = [
        # extra *_multi key present (post-migration row) — must be ignored
        {'user_id': 1, 'focus_area': 'aim', 'server_type': 'goat',
         'focus_area_multi': json.dumps(['aim', 'reflex'])},
        {'user_id': 2, 'focus_area': 'movement', 'server_type': 'goat'},
    ]
    with patch('database.get_supabase', return_value=_admin_stats_sb(quest_rows)):
        stats = database.get_admin_stats()

    assert stats['focus_distribution'] == {'Mira': 50, 'Movimento': 50}
    assert stats['top_focus_area'] == 'aim'
    assert stats['top_focus_label'] == 'Mira'


def test_admin_stats_ignores_users_with_no_focus_area():
    quest_rows = [
        {'user_id': 1, 'focus_area': 'aim', 'server_type': 'goat'},
        {'user_id': 2, 'focus_area': '', 'server_type': 'goat'},
    ]
    with patch('database.get_supabase', return_value=_admin_stats_sb(quest_rows)):
        stats = database.get_admin_stats()

    assert stats['focus_distribution'] == {'Mira': 100}
