import os
import resend

_SUBJECT = 'Redefinição de senha — FiveM PvP Trainer'


def _reset_html(name: str, reset_url: str) -> str:
    return f"""
    <div style="background:#10101c;padding:40px 20px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#16162a;border:1px solid #33334d;border-radius:12px;padding:32px;">
        <p style="color:#00d4ff;font-weight:800;font-size:18px;margin:0 0 24px;">FiveM PvP Trainer</p>
        <h1 style="color:#e8e8f0;font-size:20px;margin:0 0 16px;">Redefinir senha</h1>
        <p style="color:#a0a0b8;font-size:14px;line-height:1.5;margin:0 0 24px;">
          Olá, {name or ''}. Recebemos um pedido para redefinir a senha da sua conta.
          Se foi você, clique no botão abaixo. O link expira em 1 hora.
        </p>
        <a href="{reset_url}"
           style="display:inline-block;background:#00d4ff;color:#080810;font-weight:700;
                  text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;">
          Redefinir senha
        </a>
        <p style="color:#7a839a;font-size:12px;line-height:1.5;margin:24px 0 0;">
          Se você não pediu essa redefinição, ignore este email — sua senha continua a mesma.
        </p>
      </div>
    </div>
    """


def send_password_reset_email(to: str, name: str, reset_url: str) -> bool:
    """Send the reset-password email via Resend. Returns True on success.

    Never raises — if RESEND_API_KEY/EMAIL_FROM aren't configured yet, or the
    API call fails, this logs a warning and returns False so callers can keep
    responding with the generic message instead of breaking the request.
    """
    api_key   = os.environ.get('RESEND_API_KEY', '').strip()
    from_addr = os.environ.get('EMAIL_FROM', '').strip()

    if not api_key or not from_addr:
        print('[email] RESEND_API_KEY/EMAIL_FROM não configurados — email de redefinição não enviado')
        return False

    resend.api_key = api_key
    try:
        resend.Emails.send({
            'from':    from_addr,
            'to':      [to],
            'subject': _SUBJECT,
            'html':    _reset_html(name, reset_url),
        })
        return True
    except Exception as e:
        print(f'[email] Falha ao enviar email via Resend: {e}')
        return False
