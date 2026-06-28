import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pvp_trainer.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS questionnaire_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        focus_area TEXT NOT NULL,
        experience_level TEXT NOT NULL,
        aim_difficulty TEXT NOT NULL,
        reflex_level TEXT NOT NULL,
        movement_quality TEXT NOT NULL,
        daily_time INTEGER NOT NULL,
        preferred_tool TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS training_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        routine TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        exercise_name TEXT NOT NULL,
        score INTEGER,
        completed INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (session_id) REFERENCES training_sessions(id)
    )''')

    conn.commit()

    # Schema migration — add new FiveM-specific columns if they don't exist yet
    new_cols = [
        ('server_type', 'TEXT DEFAULT ""'),
        ('main_weapon', 'TEXT DEFAULT ""'),
        ('specific_weakness', 'TEXT DEFAULT ""'),
    ]
    for col_name, col_def in new_cols:
        try:
            c.execute(f'ALTER TABLE questionnaire_results ADD COLUMN {col_name} {col_def}')
            conn.commit()
        except Exception:
            pass  # column already exists

    conn.close()
