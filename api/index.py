import sys, os
# Ensure api/ is on the path so sub-modules resolve regardless of cwd
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from routes.auth          import auth_bp
from routes.questionnaire import questionnaire_bp
from routes.training      import training_bp
from routes.progress      import progress_bp
from routes.sensitivity   import sensitivity_bp
from routes.admin         import admin_bp
from routes.trainer       import trainer_bp

_STATIC = os.path.join(os.path.dirname(__file__), 'static')
_PAGES  = os.path.join(os.path.dirname(__file__), 'pages')

app = Flask(__name__)
CORS(app, resources={r'/api/*': {'origins': '*'}})


@app.after_request
def security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options']        = 'DENY'
    response.headers['X-XSS-Protection']       = '1; mode=block'
    response.headers['Referrer-Policy']         = 'strict-origin-when-cross-origin'
    return response


app.register_blueprint(auth_bp,           url_prefix='/api')
app.register_blueprint(questionnaire_bp,  url_prefix='/api')
app.register_blueprint(training_bp,       url_prefix='/api')
app.register_blueprint(progress_bp,       url_prefix='/api')
app.register_blueprint(sensitivity_bp,    url_prefix='/api')
app.register_blueprint(admin_bp,          url_prefix='/api')
app.register_blueprint(trainer_bp,        url_prefix='/api')


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


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
