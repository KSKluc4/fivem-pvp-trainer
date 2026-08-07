"""Rate limiting compartilhado entre as instâncias da função na Vercel.

O contador vive no Supabase, não em memória: cada requisição pode cair numa
cópia nova e fria da função serverless, então qualquer contador de processo
zeraria sozinho e não protegeria nada.
"""
import traceback
from datetime import datetime, timedelta, timezone
from flask import request
from database import get_supabase

TABLE = 'rate_limit_hits'


def client_ip() -> str:
    """Atrás do proxy da Vercel, request.remote_addr é o próprio proxy — o IP
    real do visitante é o primeiro item de X-Forwarded-For."""
    fwd = request.headers.get('X-Forwarded-For', '')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.remote_addr or 'desconhecido'


def _is_missing_table(exc: Exception) -> bool:
    """A migration v14 é aplicada à mão DEPOIS do deploy (regra 3 do
    CLAUDE.md) — enquanto a tabela não existir não há como contar nada, e a
    resposta certa é deixar passar, não trancar todo mundo do lado de fora."""
    text = str(exc).lower()
    return (
        'pgrst205' in text
        or 'could not find the table' in text
        or f'relation "{TABLE}" does not exist' in text
    )


def check_and_hit(bucket: str, limit: int, window: timedelta, fail_open: bool = True) -> bool:
    """True = pode seguir. False = estourou o limite.

    `bucket` identifica o que está sendo contado (ex.: 'login:ip:203.0.113.9').

    `fail_open` decide o comportamento quando o Supabase está fora do ar:
    True nas rotas de login (uma falha de banco não pode trancar todo mundo
    para fora), False na rota que gasta dinheiro por chamada. Tabela ausente
    é tratada à parte, sempre deixando passar — ver _is_missing_table.
    """
    since = (datetime.now(timezone.utc) - window).isoformat()
    try:
        sb  = get_supabase()
        res = (sb.table(TABLE).select('id', count='exact')
                 .eq('bucket', bucket).gte('created_at', since).execute())
        if (res.count or 0) >= limit:
            return False
        sb.table(TABLE).insert({'bucket': bucket}).execute()
        return True
    except Exception as exc:
        traceback.print_exc()
        if _is_missing_table(exc):
            print(f'[rate_limit] tabela {TABLE} ausente — migration v14 ainda não aplicada')
            return True
        return fail_open


def purge_old_hits(older_than: timedelta = timedelta(days=2)) -> None:
    """Limpeza chamada pelo cron diário (/api/health) — a tabela é puro
    contador descartável e não deve crescer para sempre. Best-effort."""
    cutoff = (datetime.now(timezone.utc) - older_than).isoformat()
    try:
        get_supabase().table(TABLE).delete().lt('created_at', cutoff).execute()
    except Exception:
        traceback.print_exc()
