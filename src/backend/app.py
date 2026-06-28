import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from database import init_db
from routes.questionnaire import questionnaire_bp
from routes.training import training_bp
from routes.progress import progress_bp
from routes.auth import auth_bp

_default_static = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
_static = os.environ.get('FIVEM_STATIC', _default_static)

app = Flask(__name__, static_folder=os.path.abspath(_static), static_url_path='')
CORS(app)

init_db()

app.register_blueprint(questionnaire_bp, url_prefix='/api')
app.register_blueprint(training_bp,      url_prefix='/api')
app.register_blueprint(progress_bp,      url_prefix='/api')
app.register_blueprint(auth_bp,          url_prefix='/api')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    full = os.path.join(app.static_folder, path)
    if path and os.path.exists(full):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
