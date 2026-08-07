"""Registro dos eventos que denunciam um ataque em andamento.

Uma linha JSON por evento no stdout — é o que a Vercel recolhe em Logs e o
formato que Sentry/Axiom/Logtail sabem indexar sem parser próprio.

NUNCA passe senha, hash, token ou refresh token para cá.
"""
import json
import traceback
from datetime import datetime, timezone

from flask import request

PREFIX = '[SECURITY]'


def _client_ip() -> str:
    fwd = request.headers.get('X-Forwarded-For', '')
    return fwd.split(',')[0].strip() if fwd else (request.remote_addr or 'desconhecido')


def security_event(event: str, **fields) -> None:
    """Best-effort por definição: um problema ao registrar o evento nunca pode
    derrubar a requisição que estava sendo protegida."""
    try:
        print(PREFIX + ' ' + json.dumps({
            'event': event,
            'ip':    _client_ip(),
            'ts':    datetime.now(timezone.utc).isoformat(),
            'path':  request.path,
            **fields,
        }, ensure_ascii=False))
    except Exception:
        traceback.print_exc()
