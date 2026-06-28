"""
Optional Supabase cloud sync module.

Activated only when SUPABASE_URL and SUPABASE_KEY are set as environment
variables. If not set, all sync calls are no-ops and the app works fully
offline via SQLite.

Supabase SQL to run once in the Supabase SQL editor:
------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         BIGINT PRIMARY KEY,
  name       TEXT NOT NULL,
  username   TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questionnaire_results (
  id               BIGINT PRIMARY KEY,
  user_id          BIGINT REFERENCES users(id),
  focus_area       TEXT, experience_level TEXT, aim_difficulty TEXT,
  reflex_level     TEXT, movement_quality TEXT, daily_time INTEGER,
  preferred_tool   TEXT, server_type TEXT, specific_weakness TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id         BIGINT PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id),
  date       DATE, routine JSONB, completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress (
  id            BIGINT PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id),
  session_id    BIGINT,
  exercise_name TEXT, score INTEGER, completed INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security (enable after setup)
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress           ENABLE ROW LEVEL SECURITY;
------------------------------------------------------
"""
import os
import json
import threading
import logging

log = logging.getLogger(__name__)

SUPABASE_URL         = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY         = os.environ.get('SUPABASE_KEY', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')


def _get_client():
    # Prefer service_role key (bypasses RLS); fall back to anon key
    key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
    if not SUPABASE_URL or not key:
        return None
    try:
        from supabase import create_client
        return create_client(SUPABASE_URL, key)
    except Exception as e:
        log.warning('Supabase unavailable: %s', e)
        return None


def _mark_synced(conn, table: str, row_id: int):
    try:
        conn.execute(f'UPDATE {table} SET synced = 1 WHERE id = ?', (row_id,))
    except Exception:
        pass


def sync_user(user_id: int):
    from database import get_db
    client = _get_client()
    if not client:
        return

    conn = get_db()
    try:
        user = conn.execute('SELECT id, name, username FROM users WHERE id = ?', (user_id,)).fetchone()
        if user:
            client.table('users').upsert({
                'id': user['id'], 'name': user['name'], 'username': user['username'],
            }).execute()

        # Sync unsynced questionnaire results
        for r in conn.execute(
            'SELECT * FROM questionnaire_results WHERE user_id = ? AND synced = 0', (user_id,)
        ).fetchall():
            try:
                client.table('questionnaire_results').upsert({
                    'id': r['id'], 'user_id': r['user_id'],
                    'focus_area': r['focus_area'], 'experience_level': r['experience_level'],
                    'aim_difficulty': r['aim_difficulty'], 'reflex_level': r['reflex_level'],
                    'movement_quality': r['movement_quality'], 'daily_time': r['daily_time'],
                    'preferred_tool': r['preferred_tool'], 'server_type': r['server_type'],
                    'specific_weakness': r['specific_weakness'],
                }).execute()
                _mark_synced(conn, 'questionnaire_results', r['id'])
            except Exception as e:
                log.warning('Sync questionnaire_results %d failed: %s', r['id'], e)

        # Sync unsynced training sessions
        for s in conn.execute(
            'SELECT * FROM training_sessions WHERE user_id = ? AND synced = 0', (user_id,)
        ).fetchall():
            try:
                client.table('training_sessions').upsert({
                    'id': s['id'], 'user_id': s['user_id'],
                    'date': s['date'], 'routine': json.loads(s['routine']),
                    'completed': bool(s['completed']),
                }).execute()
                _mark_synced(conn, 'training_sessions', s['id'])
            except Exception as e:
                log.warning('Sync training_sessions %d failed: %s', s['id'], e)

        # Sync unsynced progress entries
        for p in conn.execute(
            'SELECT * FROM progress WHERE user_id = ? AND synced = 0', (user_id,)
        ).fetchall():
            try:
                client.table('progress').upsert({
                    'id': p['id'], 'user_id': p['user_id'], 'session_id': p['session_id'],
                    'exercise_name': p['exercise_name'], 'score': p['score'],
                    'completed': p['completed'],
                }).execute()
                _mark_synced(conn, 'progress', p['id'])
            except Exception as e:
                log.warning('Sync progress %d failed: %s', p['id'], e)

        conn.commit()
    except Exception as e:
        log.error('sync_user error: %s', e)
    finally:
        conn.close()


def pull_user_data(user_id: int):
    """Pull cloud data to local SQLite (used when installing on a new device)."""
    from database import get_db
    client = _get_client()
    if not client:
        return

    conn = get_db()
    try:
        local = conn.execute('SELECT COUNT(*) as n FROM questionnaire_results WHERE user_id = ?', (user_id,)).fetchone()
        if local['n'] > 0:
            return  # Already has local data — don't overwrite

        resp = client.table('questionnaire_results').select('*').eq('user_id', user_id).execute()
        for r in (resp.data or []):
            try:
                conn.execute('''INSERT OR IGNORE INTO questionnaire_results
                    (id, user_id, focus_area, experience_level, aim_difficulty,
                     reflex_level, movement_quality, daily_time, preferred_tool,
                     server_type, specific_weakness, synced)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,1)''',
                    (r['id'], r['user_id'], r.get('focus_area',''), r.get('experience_level',''),
                     r.get('aim_difficulty',''), r.get('reflex_level',''), r.get('movement_quality',''),
                     r.get('daily_time', 30), r.get('preferred_tool',''), r.get('server_type',''),
                     r.get('specific_weakness','')))
            except Exception:
                pass
        conn.commit()
    except Exception as e:
        log.error('pull_user_data error: %s', e)
    finally:
        conn.close()


def sync_async(user_id: int):
    threading.Thread(target=sync_user, args=(user_id,), daemon=True).start()


def is_enabled() -> bool:
    return bool(SUPABASE_URL and (SUPABASE_SERVICE_KEY or SUPABASE_KEY))
