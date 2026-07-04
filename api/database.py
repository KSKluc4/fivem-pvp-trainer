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
    res = sb.table('users').select('id,name,username,email,password_hash,created_at,is_admin').eq('username', username).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_id(user_id: int):
    sb = get_supabase()
    res = sb.table('users').select('id,name,username,email,created_at,is_admin').eq('id', user_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_email(email: str):
    sb = get_supabase()
    res = sb.table('users').select('id,name,username,email,created_at,is_admin').eq('email', email).limit(1).execute()
    return res.data[0] if res.data else None


def create_user(name: str, username: str, password_hash: str, email: str = None) -> int:
    from datetime import datetime, timezone
    sb      = get_supabase()
    payload = {'name': name, 'username': username, 'password_hash': password_hash}
    if email:
        payload['email']          = email
        payload['email_added_at'] = datetime.now(timezone.utc).isoformat()
    res = sb.table('users').insert(payload).execute()
    return res.data[0]['id']


def email_taken_by_other(email: str, user_id: int) -> bool:
    sb = get_supabase()
    res = sb.table('users').select('id').eq('email', email).neq('id', user_id).limit(1).execute()
    return bool(res.data)


def set_user_email(user_id: int, email: str):
    from datetime import datetime, timezone
    sb  = get_supabase()
    res = (sb.table('users')
             .update({'email': email, 'email_added_at': datetime.now(timezone.utc).isoformat()})
             .eq('id', user_id)
             .execute())
    return res.data[0] if res.data else None


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


# ── Goals ─────────────────────────────────────────────────────────────────────

def list_goals(user_id: int, period: str, period_start: str) -> list:
    sb = get_supabase()
    res = (sb.table('goals')
             .select('id,period,category,title,description,period_start,completed,completed_at,level,level_note')
             .eq('user_id', user_id)
             .eq('period', period)
             .eq('period_start', period_start)
             .order('id')
             .execute())
    return res.data or []


def create_goals(user_id: int, goals: list) -> list:
    if not goals:
        return []
    sb   = get_supabase()
    rows = [{**goal, 'user_id': user_id} for goal in goals]
    try:
        res = sb.table('goals').insert(rows).execute()
        return res.data or []
    except Exception:
        # Race: another request already generated goals for this period —
        # fall back to whatever is already persisted instead of erroring.
        return list_goals(user_id, rows[0]['period'], rows[0]['period_start'])


def get_goal(goal_id: int, user_id: int):
    sb = get_supabase()
    res = (sb.table('goals')
             .select('id,period,category,title,description,period_start,completed,completed_at,level,level_note')
             .eq('id', goal_id)
             .eq('user_id', user_id)
             .limit(1)
             .execute())
    return res.data[0] if res.data else None


def toggle_goal(goal_id: int, user_id: int):
    from datetime import datetime, timezone
    goal = get_goal(goal_id, user_id)
    if not goal:
        return None
    sb            = get_supabase()
    new_completed = not goal['completed']
    completed_at  = datetime.now(timezone.utc).isoformat() if new_completed else None
    res = (sb.table('goals')
             .update({'completed': new_completed, 'completed_at': completed_at})
             .eq('id', goal_id).eq('user_id', user_id)
             .execute())
    return res.data[0] if res.data else None


def get_recent_category_completions(user_id: int, category: str, limit: int = 2) -> list:
    """Last `limit` daily goals of this category, most-recent first, as booleans."""
    sb = get_supabase()
    res = (sb.table('goals')
             .select('period_start,completed')
             .eq('user_id', user_id)
             .eq('period', 'daily')
             .eq('category', category)
             .order('period_start', desc=True)
             .limit(limit)
             .execute())
    return [bool(r['completed']) for r in (res.data or [])]


def get_goal_level(user_id: int, category: str):
    sb = get_supabase()
    res = (sb.table('goal_levels')
             .select('id,current_level')
             .eq('user_id', user_id)
             .eq('category', category)
             .limit(1)
             .execute())
    return res.data[0] if res.data else None


def upsert_goal_level(user_id: int, category: str, level: int):
    from datetime import datetime, timezone
    sb = get_supabase()
    sb.table('goal_levels').upsert({
        'user_id':       user_id,
        'category':      category,
        'current_level': level,
        'updated_at':    datetime.now(timezone.utc).isoformat(),
    }, on_conflict='user_id,category').execute()


def get_daily_goal_complete_dates(user_id: int) -> set:
    from collections import Counter
    sb = get_supabase()
    res = (sb.table('goals')
             .select('period_start')
             .eq('user_id', user_id)
             .eq('period', 'daily')
             .eq('completed', True)
             .execute())
    counts = Counter(r['period_start'] for r in (res.data or []))
    return {d for d, c in counts.items() if c >= 3}


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


# ── Password reset tokens ─────────────────────────────────────────────────────

def count_recent_password_reset_requests(user_id: int, since_iso: str) -> int:
    sb  = get_supabase()
    res = (sb.table('password_reset_tokens')
             .select('id')
             .eq('user_id', user_id)
             .gte('created_at', since_iso)
             .execute())
    return len(res.data or [])


def create_password_reset_token(user_id: int, token_hash: str, expires_at: str):
    sb = get_supabase()
    sb.table('password_reset_tokens').insert({
        'user_id':    user_id,
        'token_hash': token_hash,
        'expires_at': expires_at,
    }).execute()


def get_valid_reset_token(token_hash: str):
    sb  = get_supabase()
    res = (sb.table('password_reset_tokens')
             .select('id,user_id,expires_at,used')
             .eq('token_hash', token_hash)
             .eq('used', False)
             .limit(1)
             .execute())
    return res.data[0] if res.data else None


def invalidate_user_reset_tokens(user_id: int):
    sb = get_supabase()
    sb.table('password_reset_tokens').update({'used': True}).eq('user_id', user_id).eq('used', False).execute()


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

    # Calculate streak from completed sessions' dates, descending. A day also
    # counts as active if all 3 daily goals were completed that day — same
    # streak, no double counting (dates are merged into a set).
    active_dates = {r['date'] for r in completed_sessions}
    try:
        active_dates |= get_daily_goal_complete_dates(user_id)
    except Exception:
        pass  # goals table not migrated yet — streak still works from sessions alone

    completed_dates = sorted(active_dates, reverse=True)
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
