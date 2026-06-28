"""
Backend-only launcher (no browser open).
Used by the Electron wrapper — Electron handles the window.
Accepts --port <n> (default 5000).
"""
import sys
import os
import argparse

def _resource(rel):
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, rel)
    root = os.path.dirname(os.path.abspath(__file__))
    if rel == 'frontend_dist':
        return os.path.join(root, 'src', 'frontend', 'dist')
    return os.path.join(root, 'src', 'backend', rel)

if not getattr(sys, 'frozen', False):
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'backend'))

_db_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'FiveM-PvP-Trainer')
os.makedirs(_db_dir, exist_ok=True)
os.environ['FIVEM_DB_PATH'] = os.path.join(_db_dir, 'trainer.db')
os.environ['FIVEM_STATIC']  = _resource('frontend_dist')

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=5000)
args, _ = parser.parse_known_args()

from app import app

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=args.port, debug=False, use_reloader=False, threaded=True)
