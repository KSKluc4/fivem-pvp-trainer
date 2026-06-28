import os
import json
from supabase import create_client, Client


def get_supabase() -> Client:
    url = os.environ['SUPABASE_URL'].strip()
    key = (
        os.environ.get('SUPABASE_SECRET_KEY') or
        os.environ.get('SUPABASE_SERVICE_KEY') or
        os.environ.get('SUPABASE_KEY') or ''
    ).strip()
    if not url or not key:
        raise RuntimeError('SUPABASE_URL and SUPABASE_SECRET_KEY must be set')
    return create_client(url, key)


# ── Users ─────────────────────────────────────────────────────────────────────

def get_user_by_username(username: str):
    sb = get_supabase()
    res = sb.table('users').select('id,name,username,password_hash,created_at').eq('username', username).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_id(user_id: int):
    sb = get_supabase()
    res = sb.table('users').select('id,name,username,created_at').eq('id', user_id).limit(1).execute()
    return res.data[0] if res.data else None


def create_user(name: str, username: str, password_hash: str) -> int:
    sb = get_supabase()
    res = sb.table('users').insert({'name': name, 'username': username, 'password_hash': password_hash}).execute()
    return res.data[0]['id']


def update_user(user_id: int, name: str, username: str):
    sb = get_supabase()
    res = sb.table('users').update({'name': name, 'username': username}).eq('id', user_id).execute()
    return res.data[0] if res.data else None


def update_password(user_id: int, password_hash: str):
    sb = get_supabase()
    sb.table('users').update({'password_hash': password_hash}).eq('id', user_id).execute()


def username_taken_by_other(username: str, user_id: int) -> bool:
    sb = get_supabase()
    res = sb.table('users').select('id').eq('username', username).neq('id', user_id).limit(1).execute()
    return bool(res.data)


# ── Sessions (refresh tokens) ─────────────────────────────────────────────────

def create_session(user_id: int, token: str, expires_at: str):
    sb = get_supabase()
    # Cleanup: keep only last 5 sessions per user
    all_sessions = sb.table('sessions').select('id').eq('user_id', user_id).order('created_at', desc=True).execute()
    to_delete = [s['id'] for s in all_sessions.data[5:]]
    if to_delete:
        sb.table('sessions').delete().in_('id', to_delete).execute()
    sb.table('sessions').insert({'user_id': user_id, 'token': token, 'expires_at': expires_at}).execute()


def get_session(token: str):
    sb = get_supabase()
    res = sb.table('sessions').select('user_id,expires_at').eq('token', token).limit(1).execute()
    return res.data[0] if res.data else None


def delete_session(token: str):
    sb = get_supabase()
    sb.table('sessions').delete().eq('token', token).execute()


# ── Questionnaire ─────────────────────────────────────────────────────────────

def save_questionnaire(user_id: int, data: dict):
    sb = get_supabase()
    sb.table('questionnaire_results').insert({
        'user_id':          user_id,
        'focus_area':       data.get('focus_area', 'aim'),
        'experience_level': data.get('experience_level', 'iniciante'),
        'aim_difficulty':   data.get('aim_difficulty', ''),
        'reflex_level':     data.get('reflex_level', ''),
        'movement_quality': data.get('movement_quality', ''),
        'daily_time':       int(data.get('daily_time', 30)),
        'preferred_tool':   data.get('preferred_tool', 'aimlab'),
        'server_type':      data.get('server_type', ''),
        'main_weapon':      data.get('main_weapon', ''),
        'specific_weakness': data.get('specific_weakness', ''),
    }).execute()


def get_latest_questionnaire(user_id: int):
    sb = get_supabase()
    res = (sb.table('questionnaire_results')
             .select('*')
             .eq('user_id', user_id)
             .order('created_at', desc=True)
             .limit(1)
             .execute())
    return res.data[0] if res.data else None


# ── Training sessions ─────────────────────────────────────────────────────────

def get_today_session(user_id: int, today: str):
    sb = get_supabase()
    res = (sb.table('training_sessions')
             .select('id,routine,completed')
             .eq('user_id', user_id)
             .eq('date', today)
             .order('created_at', desc=True)
             .limit(1)
             .execute())
    if not res.data:
        return None
    row = res.data[0]
    routine = row['routine']
    if isinstance(routine, str):
        routine = json.loads(routine)
    return {'id': row['id'], 'routine': routine, 'completed': row['completed']}


def create_training_session(user_id: int, today: str, routine: dict) -> int:
    sb = get_supabase()
    res = sb.table('training_sessions').insert({
        'user_id': user_id,
        'date':    today,
        'routine': routine,
    }).execute()
    return res.data[0]['id']


# ── Progress ──────────────────────────────────────────────────────────────────

def save_progress_entry(user_id: int, session_id: int, exercise_name: str,
                         score, completed: bool, notes: str):
    sb = get_supabase()
    sb.table('progress').insert({
        'user_id':       user_id,
        'session_id':    session_id,
        'exercise_name': exercise_name,
        'score':         score,
        'completed':     bool(completed),
        'notes':         notes or '',
    }).execute()


def mark_session_completed(session_id: int, user_id: int):
    sb = get_supabase()
    sb.table('training_sessions').update({'completed': True}).eq('id', session_id).eq('user_id', user_id).execute()


def get_progress_history(user_id: int, limit: int = 30):
    sb = get_supabase()
    res = (sb.table('training_sessions')
             .select('date,completed,progress(id)')
             .eq('user_id', user_id)
             .order('date', desc=True)
             .limit(limit)
             .execute())
    return [
        {
            'date':             r['date'],
            'completed':        bool(r['completed']),
            'exercises_logged': len(r.get('progress') or []),
        }
        for r in res.data
    ]


# ── Stats (for /auth/me) ──────────────────────────────────────────────────────

def get_user_stats(user_id: int) -> dict:
    from datetime import date, timedelta
    sb = get_supabase()

    all_sessions = (sb.table('training_sessions')
                      .select('date,completed')
                      .eq('user_id', user_id)
                      .execute())
    dates = list({r['date'] for r in all_sessions.data})
    completed_sessions = [r for r in all_sessions.data if r['completed']]

    exs = (sb.table('progress')
             .select('id')
             .eq('user_id', user_id)
             .eq('completed', True)
             .neq('exercise_name', '__session__')
             .execute())

    # Calculate streak from completed sessions' dates, descending
    completed_dates = sorted(
        {r['date'] for r in completed_sessions},
        reverse=True,
    )
    streak = 0
    today  = date.today()
    prev   = today
    for d_str in completed_dates:
        try:
            d = date.fromisoformat(str(d_str)[:10])
        except ValueError:
            continue
        if (prev - d).days <= 1:
            streak += 1
            prev = d
        else:
            break

    return {
        'days_trained':       len(dates),
        'sessions_completed': len(completed_sessions),
        'exercises_done':     len(exs.data),
        'streak':             streak,
    }
