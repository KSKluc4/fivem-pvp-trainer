import sqlite3
import os


def _db_path():
    env = os.environ.get('FIVEM_DB_PATH')
    if env:
        os.makedirs(os.path.dirname(env), exist_ok=True)
        return env
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pvp_trainer.db')


def get_db():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c    = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        username      TEXT,
        password_hash TEXT,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        token      TEXT    NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS questionnaire_results (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id          INTEGER NOT NULL,
        focus_area       TEXT NOT NULL,
        experience_level TEXT NOT NULL,
        aim_difficulty   TEXT NOT NULL,
        reflex_level     TEXT NOT NULL,
        movement_quality TEXT NOT NULL,
        daily_time       INTEGER NOT NULL,
        preferred_tool   TEXT NOT NULL,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS training_sessions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        date       TEXT    NOT NULL,
        routine    TEXT    NOT NULL,
        completed  INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS progress (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL,
        session_id    INTEGER NOT NULL,
        exercise_name TEXT    NOT NULL,
        score         INTEGER,
        completed     INTEGER DEFAULT 0,
        notes         TEXT,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)   REFERENCES users(id),
        FOREIGN KEY (session_id) REFERENCES training_sessions(id)
    )''')

    conn.commit()

    # Schema migrations (idempotent — columns added only once)
    migrations = [
        ('questionnaire_results', 'server_type',       'TEXT DEFAULT ""'),
        ('questionnaire_results', 'main_weapon',       'TEXT DEFAULT ""'),
        ('questionnaire_results', 'specific_weakness', 'TEXT DEFAULT ""'),
        ('users',                 'username',           'TEXT'),
        ('users',                 'password_hash',      'TEXT'),
    ]
    for table, col, defn in migrations:
        try:
            c.execute(f'ALTER TABLE {table} ADD COLUMN {col} {defn}')
            conn.commit()
        except Exception:
            pass  # column already exists

    conn.close()
