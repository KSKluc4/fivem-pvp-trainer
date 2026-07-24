import os
import json
import traceback
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
#
# Sensitivity fields (gta_sensitivity/dpi/fine_tune_multiplier, migration v10)
# are deliberately NOT in this shared field list — it's selected on every
# login/register/refresh, and a user running the app before that migration
# is applied would otherwise break the entire login flow with a missing-
# column error. get_user_sensitivity() below fetches them separately, only
# where actually displayed (/auth/me), wrapped by the caller so a missing
# migration degrades to "no sensitivity set yet" instead of a 500.
_USER_FIELDS = 'id,name,username,email,created_at,is_admin,avatar_url,banner_url,bio'


def get_user_by_username(username: str):
    sb = get_supabase()
    res = sb.table('users').select(_USER_FIELDS + ',password_hash').eq('username', username).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_id(user_id: int):
    sb = get_supabase()
    res = sb.table('users').select(_USER_FIELDS).eq('id', user_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_email(email: str):
    sb = get_supabase()
    res = sb.table('users').select(_USER_FIELDS + ',password_hash').eq('email', email).limit(1).execute()
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


def update_user_bio(user_id: int, bio: str):
    sb = get_supabase()
    res = sb.table('users').update({'bio': bio}).eq('id', user_id).execute()
    return res.data[0] if res.data else None


def update_user_avatar_url(user_id: int, avatar_url):
    sb = get_supabase()
    res = sb.table('users').update({'avatar_url': avatar_url}).eq('id', user_id).execute()
    return res.data[0] if res.data else None


def update_user_banner_url(user_id: int, banner_url):
    sb = get_supabase()
    res = sb.table('users').update({'banner_url': banner_url}).eq('id', user_id).execute()
    return res.data[0] if res.data else None


def get_user_sensitivity(user_id: int):
    """Fetched separately from _USER_FIELDS (see comment above it) — callers
    must catch the exception this raises when migration v10 hasn't run yet."""
    sb = get_supabase()
    res = (sb.table('users').select('gta_sensitivity,dpi,fine_tune_multiplier')
             .eq('id', user_id).limit(1).execute())
    return res.data[0] if res.data else None


def update_user_sensitivity(user_id: int, gta_sensitivity: float, dpi: int, fine_tune_multiplier: float = None):
    """Single source of truth for the user's sensitivity — read/written by
    both the "Minha Sensibilidade" screen and the in-app trainer. `fine_tune_multiplier`
    is trainer-only polish; omit it (None) to leave whatever value is already
    saved untouched (e.g. when saving from the main sensitivity screen)."""
    sb = get_supabase()
    payload = {'gta_sensitivity': gta_sensitivity, 'dpi': dpi}
    if fine_tune_multiplier is not None:
        payload['fine_tune_multiplier'] = fine_tune_multiplier
    res = sb.table('users').update(payload).eq('id', user_id).execute()
    return res.data[0] if res.data else None


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
#
# specific_weakness/focus_area/aim_difficulty support up to 2 selections
# (SPEC-004) — the legacy TEXT columns keep receiving the first choice only
# (every existing consumer, including admin stats, stays untouched), while
# the *_multi columns (migration v12) hold the full JSON array. `data` here
# may hold either a list or a bare scalar for these 3 keys (a list once it's
# gone through routes.questionnaire's normalization; a scalar from any older
# caller) — `_scalar`/`_list_json` accept both.

def _scalar(value, default):
    """First item if `value` is a list, the value itself if scalar, `default`
    if empty/missing — the legacy TEXT columns only ever hold one value."""
    if isinstance(value, list):
        return value[0] if value else default
    return value if value else default


def _list_json(value, default):
    """JSON-encodes `value` as an array, wrapping a bare scalar into a
    1-item array — the *_multi columns always hold a JSON array."""
    if isinstance(value, list):
        items = [v for v in value if v]
    elif value:
        items = [value]
    else:
        items = []
    return json.dumps(items or ([default] if default else []))


def save_questionnaire(user_id: int, data: dict):
    sb = get_supabase()
    row = {
        'user_id':           user_id,
        'focus_area':        _scalar(data.get('focus_area'), 'aim'),
        'experience_level':  data.get('experience_level', 'iniciante'),
        'aim_difficulty':    _scalar(data.get('aim_difficulty'), ''),
        'reflex_level':      data.get('reflex_level', ''),
        'movement_quality':  data.get('movement_quality', ''),
        'daily_time':        int(data.get('daily_time', 30)),
        'preferred_tool':    data.get('preferred_tool', 'aimlab'),
        'server_type':       data.get('server_type', ''),
        'main_weapon':       data.get('main_weapon', ''),
        'specific_weakness': _scalar(data.get('specific_weakness'), ''),
    }
    multi_row = {
        **row,
        'focus_area_multi':        _list_json(data.get('focus_area'), 'aim'),
        'aim_difficulty_multi':    _list_json(data.get('aim_difficulty'), ''),
        'specific_weakness_multi': _list_json(data.get('specific_weakness'), ''),
    }
    try:
        sb.table('questionnaire_results').insert(multi_row).execute()
    except Exception:
        # The *_multi columns (migration v12) may not exist yet on a
        # freshly-deployed backend — degrade to the legacy-only insert
        # instead of failing the whole questionnaire submission, same
        # pattern as sens_calibrations (routes/sensitivity.py).
        traceback.print_exc()
        sb.table('questionnaire_results').insert(row).execute()


def _multi_or_legacy(row: dict, multi_key: str, legacy_key: str) -> list:
    raw = row.get(multi_key)
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list) and parsed:
                return parsed
        except (TypeError, ValueError):
            pass
    legacy = row.get(legacy_key)
    return [legacy] if legacy else []


def get_latest_questionnaire(user_id: int):
    sb = get_supabase()
    res = (sb.table('questionnaire_results')
             .select('*')
             .eq('user_id', user_id)
             .order('created_at', desc=True)
             .limit(1)
             .execute())
    row = res.data[0] if res.data else None
    if row is None:
        return None
    # Perfil antigo (colunas *_multi ausentes/NULL, migration v12 não aplicada
    # ou linha anterior a ela) vira array de 1 item a partir da coluna legada;
    # perfil novo usa o array completo já salvo. generate_routine (e qualquer
    # outro consumidor) só vê listas para estes 3 campos a partir daqui.
    row['focus_area']        = _multi_or_legacy(row, 'focus_area_multi', 'focus_area')
    row['aim_difficulty']    = _multi_or_legacy(row, 'aim_difficulty_multi', 'aim_difficulty')
    row['specific_weakness'] = _multi_or_legacy(row, 'specific_weakness_multi', 'specific_weakness')
    return row


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


# ── Aim trainer scores ────────────────────────────────────────────────────────

def save_trainer_score(user_id: int, exercise: str, difficulty: str,
                        score: int, accuracy: float, duration_s: int):
    sb = get_supabase()
    res = sb.table('trainer_scores').insert({
        'user_id':    user_id,
        'exercise':   exercise,
        'difficulty': difficulty,
        'score':      score,
        'accuracy':   accuracy,
        'duration_s': duration_s,
    }).execute()
    return res.data[0] if res.data else None


def get_trainer_scores(user_id: int, exercise: str = None, limit: int = 50):
    sb = get_supabase()
    query = (sb.table('trainer_scores')
               .select('id,exercise,difficulty,score,accuracy,duration_s,created_at')
               .eq('user_id', user_id))
    if exercise:
        query = query.eq('exercise', exercise)
    res = query.order('created_at', desc=True).limit(limit).execute()
    return res.data or []


# ── Sensitivity discovery calibrations (migration v11) ────────────────────────
#
# Callers must catch the exception these raise when migration v11 hasn't run
# yet on a freshly-deployed backend (the user applies the SQL manually,
# after deploy) — see routes/sensitivity.py for the graceful degradation.

def save_sens_calibration(user_id: int, data: dict):
    sb = get_supabase()
    res = sb.table('sens_calibrations').insert({
        'user_id':            user_id,
        'sens_at_test':       data['sens_at_test'],
        'dpi_at_test':        data['dpi_at_test'],
        'flick_ratio_median': data.get('flick_ratio_median'),
        'overshoot_rate':     data.get('overshoot_rate'),
        'tracking_error':     data.get('tracking_error'),
        'verdict':            data['verdict'],
        'suggested_sens':     data.get('suggested_sens'),
    }).execute()
    return res.data[0] if res.data else None


def get_sens_calibrations(user_id: int, limit: int = 10):
    sb = get_supabase()
    res = (sb.table('sens_calibrations')
             .select('id,sens_at_test,dpi_at_test,flick_ratio_median,overshoot_rate,'
                     'tracking_error,verdict,suggested_sens,applied,created_at')
             .eq('user_id', user_id)
             .order('created_at', desc=True)
             .limit(limit)
             .execute())
    return res.data or []


def mark_sens_calibration_applied(user_id: int, calibration_id: int):
    sb = get_supabase()
    res = (sb.table('sens_calibrations')
             .update({'applied': True})
             .eq('id', calibration_id)
             .eq('user_id', user_id)
             .execute())
    return res.data[0] if res.data else None


# ── Adaptive mata-mata level ──────────────────────────────────────────────────
#
# The `goals` table itself is no longer written to (the Metas feature was
# removed) — existing rows are left untouched. `goal_levels` is still used,
# now to track the mata-mata (category='action') difficulty level.

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


def get_recent_ingame_completion(user_id: int, limit: int = 2) -> list:
    """Whether ALL in-game (mata-mata) matches were completed, for the last
    `limit` days that had an in-game block — most-recent first.

    Legacy sessions predating the mata-mata block (no exercises tagged
    category='in-game', e.g. old 'Revisão' routines) are skipped entirely —
    they neither help nor hurt the adaptive level.
    """
    from collections import defaultdict
    from datetime import date
    sb = get_supabase()

    today        = date.today().isoformat()
    sessions_res = (sb.table('training_sessions')
                      .select('id,date,routine')
                      .eq('user_id', user_id)
                      .neq('date', today)
                      .order('date', desc=True)
                      .limit(limit + 5)  # buffer for legacy sessions we'll skip
                      .execute())
    sessions = sessions_res.data or []
    if not sessions:
        return []

    session_ids  = [s['id'] for s in sessions]
    progress_res = (sb.table('progress')
                      .select('session_id,exercise_name')
                      .in_('session_id', session_ids)
                      .eq('completed', True)
                      .execute())
    completed_by_session = defaultdict(set)
    for p in (progress_res.data or []):
        completed_by_session[p['session_id']].add(p['exercise_name'])

    results = []
    for s in sessions:
        if len(results) >= limit:
            break
        routine = s['routine']
        if isinstance(routine, str):
            routine = json.loads(routine)
        ingame_names = {
            ex['name']
            for section in (routine.get('sections') or [])
            for ex in (section.get('exercises') or [])
            if ex.get('category') == 'in-game'
        }
        if not ingame_names:
            continue
        done = completed_by_session.get(s['id'], set())
        results.append(ingame_names.issubset(done))
    return results


# ── Admin ─────────────────────────────────────────────────────────────────────

def get_admin_stats() -> dict:
    from datetime import date, timedelta
    from collections import Counter
    sb = get_supabase()

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
    from datetime import date
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

    # Calculate streak from completed sessions' dates, descending. Finishing
    # the daily routine (which includes the mata-mata matches) is the only
    # criterion for an active day.
    active_dates    = {r['date'] for r in completed_sessions}
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
