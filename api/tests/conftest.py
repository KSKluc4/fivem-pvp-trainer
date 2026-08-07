import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('JWT_SECRET', 'test-secret')


def pytest_configure(config):
    config.addinivalue_line(
        'markers',
        'rate_limit: teste que exercita o rate limiting de verdade (desliga o '
        'stub automático do conftest).',
    )


@pytest.fixture(autouse=True)
def _no_rate_limit(request, monkeypatch):
    """check_and_hit conversa com o Supabase, que não existe na suíte — sem
    isso todo teste de /auth/* dependeria da ordem em que o contador falha.

    Desligado por padrão em toda a suíte; os testes dedicados (test_rate_limit.py)
    reativam com @pytest.mark.rate_limit e controlam o mock por conta própria.
    """
    if request.node.get_closest_marker('rate_limit'):
        return
    import routes.auth as auth_routes
    monkeypatch.setattr(auth_routes, 'check_and_hit', lambda *a, **k: True)
