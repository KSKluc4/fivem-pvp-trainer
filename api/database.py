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
    res = sb.table('users').select('id,name,username,password_hash,created_at,is_admin').eq('username', username).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_id(user_id: int):
    sb = get_supabase()
    res = sb.table('users').select('id,name,username,created_at,is_admin').eq('id', user_id).limit(1).execute()
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
        'completed':     1 if completed else 0,
        'notes':         notes or '',
    }).execute()


def mark_session_completed(session_id: int, user_id: int):
    sb = get_supabase()
    sb.table('training_sessions').update({'completed': 1}).eq('id', session_id).eq('user_id', user_id).execute()


def get_progress_history(user_id: int, limit: int = 30):
    from collections import Counter
    sb = get_supabase()

    sessions_res = (sb.table('training_sessions')
                      .select('id,date,completed')
                      .eq('user_id', user_id)
                      .order('date', desc=True)
                      .limit(limit)
                      .execute())

    if not sessions_res.data:
        return []

    session_ids = [s['id'] for s in sessions_res.data]
    progress_res = (sb.table('progress')
                      .select('session_id')
                      .in_('session_id', session_ids)
                      .neq('exercise_name', '__session__')
                      .execute())

    counts = Counter(p['session_id'] for p in (progress_res.data or []))

    return [
        {
            'date':             s['date'],
            'completed':        bool(s['completed']),
            'exercises_logged': counts.get(s['id'], 0),
        }
        for s in sessions_res.data
    ]


# ── Sensitivity conversions ───────────────────────────────────────────────────

def save_sensitivity_conversion(user_id: int, gta_sens: float, dpi: int,
                                 cm_360: float, kovaak: float, aimlab: float,
                                 inverted: int):
    sb = get_supabase()
    sb.table('sensitivity_conversions').insert({
        'user_id':         user_id,
        'gta_sensitivity': gta_sens,
        'dpi':             dpi,
        'cm_per_360':      cm_360,
        'kovaak_sens':     kovaak,
        'aimlab_sens':     aimlab,
        'inverted':        inverted,
    }).execute()


def get_sensitivity_history(user_id: int, limit: int = 15):
    sb = get_supabase()
    res = (sb.table('sensitivity_conversions')
             .select('id,gta_sensitivity,dpi,cm_per_360,kovaak_sens,aimlab_sens,inverted,created_at')
             .eq('user_id', user_id)
             .order('created_at', desc=True)
             .limit(limit)
             .execute())
    return res.data or []


# ── Custom user servers ───────────────────────────────────────────────────────

MAX_USER_SERVERS = 5


def list_user_servers(user_id: int) -> list:
    sb = get_supabase()
    res = (sb.table('user_servers')
             .select('id,name,cfx_code,created_at')
             .eq('user_id', user_id)
             .order('created_at')
             .execute())
    return res.data or []


def count_user_servers(user_id: int) -> int:
    sb = get_supabase()
    res = sb.table('user_servers').select('id', count='exact').eq('user_id', user_id).execute()
    return res.count or 0


def create_user_server(user_id: int, name: str, cfx_code: str) -> dict:
    sb = get_supabase()
    res = sb.table('user_servers').insert({
        'user_id':  user_id,
        'name':     name,
        'cfx_code': cfx_code,
    }).execute()
    return res.data[0]


def delete_user_server(user_id: int, server_id: int) -> bool:
    sb = get_supabase()
    res = sb.table('user_servers').delete().eq('id', server_id).eq('user_id', user_id).execute()
    return bool(res.data)


# ── Admin ─────────────────────────────────────────────────────────────────────

def get_admin_stats() -> dict:
    from datetime import date, timedelta
    from collections import Counter
    sb = get_supabase()

    today           = date.today().isoformat()
    seven_days_ago  = (date.today() - timedelta(days=7)).isoformat()
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()

    # All users
    users_res = sb.table('users').select('id,created_at').execute()
    all_users = users_res.data or []
    total_users = len(all_users)
    new_7d  = sum(1 for u in all_users if str(u.get('created_at', ''))[:10] >= seven_days_ago)
    new_30d = sum(1 for u in all_users if str(u.get('created_at', ''))[:10] >= thirty_days_ago)

    # Active users (completed a session in last 7 days)
    active_res = (sb.table('training_sessions')
                    .select('user_id')
                    .gte('date', seven_days_ago)
                    .eq('completed', 1)
                    .execute())
    active_users = len({r['user_id'] for r in (active_res.data or [])})

    # Total completed sessions
    sessions_res = (sb.table('training_sessions')
                      .select('id')
                      .eq('completed', 1)
                      .execute())
    total_sessions = len(sessions_res.data or [])

    # Focus area + server type from latest questionnaire per user
    quest_res = sb.table('questionnaire_results').select('user_id,focus_area,server_type').execute()
    quest_all = quest_res.data or []
    # Keep only latest per user (list is unordered; use last occurrence)
    latest = {}
    for q in quest_all:
        latest[q['user_id']] = q
    focus_counts  = Counter(q.get('focus_area',  '') for q in latest.values() if q.get('focus_area'))
    server_counts = Counter(q.get('server_type', '') for q in latest.values() if q.get('server_type'))

    FOCUS_LABELS  = {'aim': 'Mira', 'reflex': 'Reflexo', 'movement': 'Movimento'}
    SERVER_LABELS = {'goat': 'Goat PvP', 'ambos': 'Ambos', 'outro': 'Outro'}

    def top(counter):
        if not counter:
            return None, 0, {}
        best_key = counter.most_common(1)[0][0]
        total    = sum(counter.values())
        pcts     = {k: round(v / total * 100) for k, v in counter.items()}
        return best_key, pcts.get(best_key, 0), pcts

    top_focus,  focus_pct,  focus_dist  = top(focus_counts)
    top_server, server_pct, server_dist = top(server_counts)

    return {
        'total_users':             total_users,
        'new_users_7d':            new_7d,
        'new_users_30d':           new_30d,
        'active_users_7d':         active_users,
        'total_sessions_completed': total_sessions,
        'top_focus_area':          top_focus,
        'top_focus_label':         FOCUS_LABELS.get(top_focus, top_focus) if top_focus else None,
        'top_focus_pct':           focus_pct,
        'focus_distribution':      {FOCUS_LABELS.get(k, k): v for k, v in focus_dist.items()},
        'top_server_type':         top_server,
        'top_server_label':        SERVER_LABELS.get(top_server, top_server) if top_server else None,
        'top_server_pct':          server_pct,
        'server_distribution':     {SERVER_LABELS.get(k, k): v for k, v in server_dist.items()},
    }


def get_admin_users() -> list:
    from collections import defaultdict
    sb = get_supabase()

    users_res = (sb.table('users')
                   .select('id,name,username,created_at,is_admin')
                   .order('created_at', desc=True)
                   .execute())
    users = users_res.data or []
    if not users:
        return []

    sessions_res = (sb.table('training_sessions')
                      .select('user_id,date')
                      .eq('completed', 1)
                      .execute())
    sessions = sessions_res.data or []

    session_dates = defaultdict(list)
    for s in sessions:
        session_dates[s['user_id']].append(s['date'])

    return [
        {
            'id':             u['id'],
            'name':           u['name'],
            'username':       u['username'],
            'created_at':     u['created_at'],
            'is_admin':       bool(u.get('is_admin', 0)),
            'total_sessions': len(session_dates[u['id']]),
            'last_session':   max(session_dates[u['id']]) if session_dates[u['id']] else None,
        }
        for u in users
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
             .eq('completed', 1)
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
