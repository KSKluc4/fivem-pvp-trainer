# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

BACKEND_DIR   = os.path.join('src', 'backend')
FRONTEND_DIST = os.path.join('src', 'frontend', 'dist')

a = Analysis(
    ['launcher_backend.py'],
    pathex=[os.path.abspath(BACKEND_DIR)],
    binaries=[],
    datas=[
        (FRONTEND_DIST, 'frontend_dist'),
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'werkzeug',
        'werkzeug.serving',
        'werkzeug.debug',
        'werkzeug.security',
        'jinja2',
        'jinja2.ext',
        'click',
        'itsdangerous',
        'markupsafe',
        'database',
        'utils',
        'routes.questionnaire',
        'routes.training',
        'routes.progress',
        'routes.auth',
        'services.routine_generator',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'unittest', 'pdb', 'test'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join('assets', 'icon.ico'),
)
