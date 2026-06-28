import os
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from database import init_db
from routes.questionnaire import questionnaire_bp
from routes.training      import training_bp
from routes.progress      import progress_bp
from routes.auth          import auth_bp

_default_static = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
_static = os.environ.get('FIVEM_STATIC', _default_static)

app = Flask(__name__, static_folder=os.path.abspath(_static), static_url_path='')

# CORS: only allow localhost origins (the Electron renderer or dev server)
CORS(app, resources={r'/api/*': {
    'origins': [r'http://localhost:\d+', r'http://127\.0\.0\.1:\d+'],
}})

init_db()

app.register_blueprint(questionnaire_bp, url_prefix='/api')
app.register_blueprint(training_bp,      url_prefix='/api')
app.register_blueprint(progress_bp,      url_prefix='/api')
app.register_blueprint(auth_bp,          url_prefix='/api')


@app.after_request
def security_headers(response):
    origin = request.headers.get('Origin', '')
    # Allow localhost origins dynamically (for dynamic port)
    if origin.startswith('http://localhost:') or origin.startswith('http://127.0.0.1:'):
        response.headers['Access-Control-Allow-Origin']  = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'

    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options']        = 'DENY'
    response.headers['X-XSS-Protection']       = '1; mode=block'
    response.headers['Referrer-Policy']         = 'strict-origin-when-cross-origin'
    return response


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    full = os.path.join(app.static_folder, path)
    if path and os.path.exists(full):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
