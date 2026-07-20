import time
from flask import Blueprint, request, jsonify, g
from database import (
    update_user_bio, update_user_avatar_url, update_user_banner_url,
)
from utils import require_auth, strip_html_tags
from services.profile_image import process_image, InvalidImageError
from services.profile_storage import upload_profile_image, delete_profile_image

profile_bp = Blueprint('profile', __name__)

MAX_BIO_LEN = 200

_KINDS = {
    'avatar': {'target_size': (256, 256), 'max_bytes': 2 * 1024 * 1024},
    'banner': {'target_size': (1200, 400), 'max_bytes': 4 * 1024 * 1024},
}


def _upload_image(kind: str):
    spec = _KINDS[kind]
    file = request.files.get(kind)
    if not file or not file.filename:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    raw = file.read()
    if not raw:
        return jsonify({'error': 'Arquivo vazio'}), 400
    if len(raw) > spec['max_bytes']:
        limit_mb = spec['max_bytes'] // (1024 * 1024)
        return jsonify({'error': f'Arquivo excede o limite de {limit_mb}MB'}), 413

    try:
        processed = process_image(raw, spec['target_size'])
    except InvalidImageError as e:
        return jsonify({'error': str(e)}), 400

    # Fixed path per user/kind — every re-upload overwrites the previous
    # image (upsert:true in profile_storage) instead of accumulating files.
    path = f'{g.user_id}/{kind}.webp'
    try:
        public_url = upload_profile_image(path, processed)
    except Exception:
        return jsonify({'error': 'Falha ao enviar imagem. Tente novamente.'}), 502

    # Cache-buster: the path never changes, so without this the browser/CDN
    # would keep showing the old image after an overwrite.
    url_with_version = f'{public_url}?v={int(time.time())}'

    updated = (update_user_avatar_url(g.user_id, url_with_version) if kind == 'avatar'
               else update_user_banner_url(g.user_id, url_with_version))
    if not updated:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    return jsonify({f'{kind}_url': url_with_version})


@profile_bp.route('/profile/avatar', methods=['POST'])
@require_auth
def upload_avatar():
    return _upload_image('avatar')


@profile_bp.route('/profile/banner', methods=['POST'])
@require_auth
def upload_banner():
    return _upload_image('banner')


@profile_bp.route('/profile/avatar', methods=['DELETE'])
@require_auth
def remove_avatar():
    delete_profile_image(f'{g.user_id}/avatar.webp')
    updated = update_user_avatar_url(g.user_id, None)
    if not updated:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    return jsonify({'avatar_url': None})


@profile_bp.route('/profile/banner', methods=['DELETE'])
@require_auth
def remove_banner():
    delete_profile_image(f'{g.user_id}/banner.webp')
    updated = update_user_banner_url(g.user_id, None)
    if not updated:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    return jsonify({'banner_url': None})


@profile_bp.route('/profile', methods=['PATCH'])
@require_auth
def patch_profile():
    data = request.get_json() or {}
    if 'bio' not in data:
        return jsonify({'error': 'Nada para atualizar'}), 400

    bio = strip_html_tags(str(data.get('bio') or '')).strip()
    if len(bio) > MAX_BIO_LEN:
        return jsonify({'error': f'Bio deve ter no máximo {MAX_BIO_LEN} caracteres'}), 400

    updated = update_user_bio(g.user_id, bio)
    if not updated:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    return jsonify({'bio': updated.get('bio') or ''})
