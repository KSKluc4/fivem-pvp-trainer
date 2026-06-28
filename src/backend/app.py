from flask import Flask
from flask_cors import CORS
from database import init_db
from routes.questionnaire import questionnaire_bp
from routes.training import training_bp
from routes.progress import progress_bp

app = Flask(__name__)
CORS(app)

init_db()

app.register_blueprint(questionnaire_bp, url_prefix='/api')
app.register_blueprint(training_bp, url_prefix='/api')
app.register_blueprint(progress_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
