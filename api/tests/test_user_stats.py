import os
import sys
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import database

# Presets and the daily routine can both mark the SAME day's session as
# completed (e.g. a preset run as "extra training" after the daily routine
# is already done). Streak must not double-count that day just because
# completion was signaled more than once.


def _stats_sb(session_rows, progress_rows=None):
    def table_side_effect(name):
        m = MagicMock()
        if name == 'training_sessions':
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=session_rows)
        elif name == 'progress':
            (m.select.return_value.eq.return_value.eq.return_value
              .neq.return_value.execute.return_value) = MagicMock(data=progress_rows or [])
        return m
    sb = MagicMock()
    sb.table.side_effect = table_side_effect
    return sb


def test_streak_counts_a_completed_day_once_even_with_duplicate_date_rows():
    # Simulates the daily routine and a same-day preset both resulting in a
    # completed=True row for the same date (defensive: real schema only ever
    # has one training_sessions row per user/day, but the streak math itself
    # must not rely on that to stay correct).
    today     = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    rows = [
        {'date': today, 'completed': True},
        {'date': today, 'completed': True},
        {'date': yesterday, 'completed': True},
    ]
    with patch('database.get_supabase', return_value=_stats_sb(rows)):
        stats = database.get_user_stats(user_id=1)

    assert stats['streak'] == 2
    assert stats['sessions_completed'] == 3


def test_mark_session_completed_twice_is_a_pure_update_not_a_new_row():
    sb = MagicMock()
    with patch('database.get_supabase', return_value=sb):
        database.mark_session_completed(session_id=42, user_id=1)
        database.mark_session_completed(session_id=42, user_id=1)

    assert sb.table.return_value.insert.called is False
    assert sb.table.return_value.update.call_count == 2
    sb.table.return_value.update.assert_called_with({'completed': 1})
