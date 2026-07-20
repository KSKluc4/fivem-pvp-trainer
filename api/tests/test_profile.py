import io
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')

from flask import Flask
from PIL import Image

import routes.profile as profile_routes
from utils import create_access_token


def make_client():
    app = Flask(__name__)
    app.register_blueprint(profile_routes.profile_bp, url_prefix='/api')
    return app.test_client()


def auth_headers(user_id=7):
    return {'Authorization': f'Bearer {create_access_token(user_id)}'}


def make_image_bytes(fmt='PNG', size=(500, 300), color=(255, 0, 0)):
    buf = io.BytesIO()
    Image.new('RGB', size, color).save(buf, format=fmt)
    return buf.getvalue()


# ── POST /profile/avatar / /profile/banner — validation ──────────────────────

def test_upload_avatar_requires_auth():
    client = make_client()
    res = client.post('/api/profile/avatar', data={'avatar': (io.BytesIO(b'x'), 'a.png')},
                       content_type='multipart/form-data')
    assert res.status_code == 401


def test_upload_avatar_rejects_no_file():
    client = make_client()
    res = client.post('/api/profile/avatar', data={}, headers=auth_headers(),
                       content_type='multipart/form-data')
    assert res.status_code == 400


@patch('routes.profile.upload_profile_image')
def test_upload_avatar_rejects_exe_renamed_to_png(mock_upload):
    # Real Windows PE header ("MZ...") followed by junk — a renamed .exe.
    # Pillow's Image.open() sniffs the actual format from the header instead
    # of trusting the filename/extension, so this must be rejected.
    fake_exe = b'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff' + b'\x00' * 200
    client = make_client()

    res = client.post('/api/profile/avatar',
                       data={'avatar': (io.BytesIO(fake_exe), 'malware.png')},
                       headers=auth_headers(), content_type='multipart/form-data')

    assert res.status_code == 400
    assert 'error' in res.get_json()
    mock_upload.assert_not_called()


@patch('routes.profile.upload_profile_image')
def test_upload_avatar_rejects_oversized_file(mock_upload):
    big = make_image_bytes(size=(10, 10)) + b'\x00' * (2 * 1024 * 1024 + 1)
    client = make_client()

    res = client.post('/api/profile/avatar',
                       data={'avatar': (io.BytesIO(big), 'photo.png')},
                       headers=auth_headers(), content_type='multipart/form-data')

    assert res.status_code == 413
    mock_upload.assert_not_called()


@patch('routes.profile.update_user_avatar_url')
@patch('routes.profile.upload_profile_image')
def test_upload_avatar_processes_and_saves_valid_image(mock_upload, mock_update):
    mock_upload.return_value = 'https://xyz.supabase.co/storage/v1/object/public/profiles/7/avatar.webp'
    mock_update.return_value = {'id': 7, 'avatar_url': 'whatever'}
    client = make_client()
    png = make_image_bytes(fmt='PNG', size=(800, 600))

    res = client.post('/api/profile/avatar',
                       data={'avatar': (io.BytesIO(png), 'me.png')},
                       headers=auth_headers(user_id=7), content_type='multipart/form-data')

    assert res.status_code == 200
    body = res.get_json()
    assert body['avatar_url'].startswith('https://xyz.supabase.co/storage/v1/object/public/profiles/7/avatar.webp?v=')

    # Uploaded to the fixed per-user path, and re-encoded to webp (magic bytes
    # for a webp container: 'RIFF'...'WEBP').
    upload_path, upload_bytes = mock_upload.call_args[0]
    assert upload_path == '7/avatar.webp'
    assert upload_bytes[:4] == b'RIFF'
    assert upload_bytes[8:12] == b'WEBP'

    mock_update.assert_called_once()
    assert mock_update.call_args[0][0] == 7  # scoped to the token's user id


@patch('routes.profile.update_user_banner_url')
@patch('routes.profile.upload_profile_image')
def test_upload_banner_allows_up_to_4mb_and_crops_to_1200x400(mock_upload, mock_update):
    mock_upload.return_value = 'https://xyz.supabase.co/storage/v1/object/public/profiles/7/banner.webp'
    mock_update.return_value = {'id': 7, 'banner_url': 'whatever'}
    client = make_client()
    jpg = make_image_bytes(fmt='JPEG', size=(2000, 500))

    res = client.post('/api/profile/banner',
                       data={'banner': (io.BytesIO(jpg), 'wide.jpg')},
                       headers=auth_headers(), content_type='multipart/form-data')

    assert res.status_code == 200
    _, upload_bytes = mock_upload.call_args[0]
    saved = Image.open(io.BytesIO(upload_bytes))
    assert saved.size == (1200, 400)


def test_upload_avatar_ignores_spoofed_user_id_in_payload():
    # Even if the client tries to smuggle a different user id in the form
    # body, the route only ever reads the id from the JWT (g.user_id) — this
    # is verified by asserting whichever DB call happens is scoped to the
    # token's id (7), not the spoofed one (999), regardless of the extra field.
    with patch('routes.profile.upload_profile_image') as mock_upload, \
         patch('routes.profile.update_user_avatar_url') as mock_update:
        mock_upload.return_value = 'https://x/avatar.webp'
        mock_update.return_value = {'id': 7}
        client = make_client()
        png = make_image_bytes()

        client.post('/api/profile/avatar',
                     data={'avatar': (io.BytesIO(png), 'me.png'), 'user_id': '999'},
                     headers=auth_headers(user_id=7), content_type='multipart/form-data')

        assert mock_update.call_args[0][0] == 7


@patch('routes.profile.update_user_avatar_url')
@patch('routes.profile.delete_profile_image')
def test_delete_avatar_clears_url(mock_delete, mock_update):
    mock_update.return_value = {'id': 7, 'avatar_url': None}
    client = make_client()

    res = client.delete('/api/profile/avatar', headers=auth_headers())

    assert res.status_code == 200
    assert res.get_json() == {'avatar_url': None}
    mock_delete.assert_called_once_with('7/avatar.webp')
    mock_update.assert_called_once_with(7, None)


# ── PATCH /profile — bio ──────────────────────────────────────────────────────

def test_patch_profile_requires_auth():
    client = make_client()
    res = client.patch('/api/profile', json={'bio': 'hi'})
    assert res.status_code == 401


@patch('routes.profile.update_user_bio')
def test_patch_profile_updates_bio(mock_update):
    mock_update.return_value = {'id': 7, 'bio': 'Aim main, GOAT PvP.'}
    client = make_client()

    res = client.patch('/api/profile', json={'bio': '  Aim main, GOAT PvP.  '}, headers=auth_headers())

    assert res.status_code == 200
    mock_update.assert_called_once_with(7, 'Aim main, GOAT PvP.')


@patch('routes.profile.update_user_bio')
def test_patch_profile_strips_html_tags(mock_update):
    mock_update.return_value = {'id': 7, 'bio': 'bold text'}
    client = make_client()

    client.patch('/api/profile', json={'bio': '<b>bold</b> text'}, headers=auth_headers())

    mock_update.assert_called_once_with(7, 'bold text')


@patch('routes.profile.update_user_bio')
def test_patch_profile_rejects_bio_over_200_chars(mock_update):
    client = make_client()
    res = client.patch('/api/profile', json={'bio': 'a' * 201}, headers=auth_headers())

    assert res.status_code == 400
    mock_update.assert_not_called()


def test_patch_profile_requires_bio_field():
    client = make_client()
    res = client.patch('/api/profile', json={}, headers=auth_headers())
    assert res.status_code == 400
