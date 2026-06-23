import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _send_sync(to_email: str, reset_link: str) -> None:
    settings = get_settings()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your JobRadar password"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    text_body = (
        f"Reset your JobRadar password\n\n"
        f"Click the link below to set a new password. It expires in 1 hour.\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email."
    )

    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;padding:0 16px">
    <div style="background:#1a1f2e;border-radius:12px;padding:32px;border:1px solid #2d3748">
      <h1 style="margin:0 0 8px;font-size:20px;color:#ffffff">Reset your password</h1>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">
        Click the button below to set a new JobRadar password.<br>
        This link expires in <strong style="color:#e2e8f0">1 hour</strong>.
      </p>
      <a href="{reset_link}"
         style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">
        Reset Password
      </a>
      <p style="margin:24px 0 0;color:#475569;font-size:12px">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
    <p style="text-align:center;color:#334155;font-size:12px;margin-top:16px">JobRadar</p>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())


async def send_reset_email(to_email: str, reset_link: str) -> None:
    settings = get_settings()

    if not settings.SMTP_HOST:
        logger.info("=" * 60)
        logger.info(f"[DEV] Password reset link for {to_email}:")
        logger.info(reset_link)
        logger.info("=" * 60)
        return

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_sync, to_email, reset_link)
    logger.info(f"Password reset email sent to {to_email}")
