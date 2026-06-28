import sys
import os
import socket
import threading
import time
import webbrowser

# ── Path resolution (dev vs frozen exe) ──────────────────────────────────────
if getattr(sys, 'frozen', False):
    # PyInstaller extracts everything to sys._MEIPASS
    _BUNDLE = sys._MEIPASS
    _STATIC = os.path.join(_BUNDLE, 'frontend_dist')
    # Backend modules are compiled into the exe; no sys.path manipulation needed
else:
    # Dev mode: project root is one level above this file
    _ROOT   = os.path.dirname(os.path.abspath(__file__))
    _BUNDLE = _ROOT
    _STATIC = os.path.join(_ROOT, 'src', 'frontend', 'dist')
    sys.path.insert(0, os.path.join(_ROOT, 'src', 'backend'))

# ── Database lives in user-writable AppData folder ───────────────────────────
_db_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'FiveM-PvP-Trainer')
os.makedirs(_db_dir, exist_ok=True)
os.environ['FIVEM_DB_PATH']  = os.path.join(_db_dir, 'trainer.db')
os.environ['FIVEM_STATIC']   = _STATIC

# ── Import Flask app AFTER env vars are set ───────────────────────────────────
from app import app   # noqa: E402 — intentional late import


def _find_port(start: int = 5000) -> int:
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                pass
    return start


def _open_browser(port: int) -> None:
    time.sleep(2.2)
    webbrowser.open(f'http://localhost:{port}')


if __name__ == '__main__':
    PORT = _find_port()
    threading.Thread(target=_open_browser, args=(PORT,), daemon=True).start()
    app.run(host='127.0.0.1', port=PORT, debug=False, use_reloader=False, threaded=True)
