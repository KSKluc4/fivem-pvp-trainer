import sys, os
# Ensure api/ is on the path so sub-modules resolve regardless of cwd
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from routes.auth          import auth_bp
from routes.questionnaire import questionnaire_bp
from routes.training      import training_bp
from routes.progress      import progress_bp
from routes.sensitivity   import sensitivity_bp
from routes.admin         import admin_bp
from routes.trainer       import trainer_bp
from routes.profile       import profile_bp

_STATIC = os.path.join(os.path.dirname(__file__), 'static')
_PAGES  = os.path.join(os.path.dirname(__file__), 'pages')
_SITE   = os.path.join(os.path.dirname(__file__), '..', 'site')

# Top-level assets for the public landing page (site/) — named distinctly
# from the Electron/React app's own (content-hashed) build output under
# api/static/assets/, so the two can never collide.
_SITE_ASSETS = {'style.css', 'script.js', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'og-image.png'}


def _is_electron_request() -> bool:
    return 'Electron' in request.headers.get('User-Agent', '')


app = Flask(__name__)
CORS(app, resources={r'/api/*': {'origins': '*'}})

# Banner uploads are capped at 4MB (see routes/profile.py) — this global cap
# is a bit above that to leave room for multipart overhead, and doubles as a
# blanket defense against oversized bodies on every other (JSON) route.
app.config['MAX_CONTENT_LENGTH'] = 6 * 1024 * 1024


@app.after_request
def security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options']        = 'DENY'
    response.headers['X-XSS-Protection']       = '1; mode=block'
    response.headers['Referrer-Policy']         = 'strict-origin-when-cross-origin'
    return response


@app.errorhandler(413)
def request_too_large(_e):
    return jsonify({'error': 'Arquivo excede o tamanho máximo permitido'}), 413


app.register_blueprint(auth_bp,           url_prefix='/api')
app.register_blueprint(questionnaire_bp,  url_prefix='/api')
app.register_blueprint(training_bp,       url_prefix='/api')
app.register_blueprint(progress_bp,       url_prefix='/api')
app.register_blueprint(sensitivity_bp,    url_prefix='/api')
app.register_blueprint(admin_bp,          url_prefix='/api')
app.register_blueprint(trainer_bp,        url_prefix='/api')
app.register_blueprint(profile_bp,        url_prefix='/api')


@app.route('/api/health')
def health():
    # Also pinged once a day by the Vercel Cron in vercel.json — a minimal DB
    # touch keeps the Supabase free-tier project from auto-pausing on inactivity.
    db_ok = False
    try:
        from database import get_supabase
        get_supabase().table('users').select('id').limit(1).execute()
        db_ok = True
    except Exception:
        db_ok = False
    return jsonify({'ok': True, 'db': db_ok})


@app.route('/api')
def api_root():
    return jsonify({'status': 'ok'})


# Standalone page (not part of the React SPA) — reached from the reset-password email link
@app.route('/reset-password')
def reset_password_page():
    return send_from_directory(_PAGES, 'reset_password.html')


# Serve React SPA — all non-API routes return index.html
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    # Public landing page assets (site/) — checked first so /style.css,
    # /script.js etc. resolve here rather than falling through to the app's
    # own (differently-named) static files.
    if path in _SITE_ASSETS and os.path.isfile(os.path.join(_SITE, path)):
        return send_from_directory(_SITE, path)

    # Root path ("/"): the desktop app's Electron shell loads this exact URL
    # to render its own UI (see electron/main.js loadURL) — everyone else
    # gets the public marketing landing page instead. Branching on
    # User-Agent (Electron's default UA always includes "Electron/") means
    # this works without ever shipping a new Electron build.
    if path == '' and not _is_electron_request() and os.path.isfile(os.path.join(_SITE, 'index.html')):
        return send_from_directory(_SITE, 'index.html')

    if not os.path.isdir(_STATIC):
        return jsonify({'error': 'Frontend not built — run npm run build in src/frontend'}), 503
    full = os.path.join(_STATIC, path)
    if path and os.path.isfile(full):
        resp = send_from_directory(_STATIC, path)
        # Hashed assets (JS/CSS with content hash in filename) are immutable
        if path.startswith('assets/'):
            resp.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
        return resp
    # index.html must never be cached — always fetch fresh so new JS bundles load
    resp = send_from_directory(_STATIC, 'index.html')
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    resp.headers['Pragma']        = 'no-cache'
    resp.headers['Expires']       = '0'
    return resp
