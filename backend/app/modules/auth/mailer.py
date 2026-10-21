import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("app.mail")


def send_email(to: str, subject: str, body: str) -> None:
    """Blocking SMTP send (run it in a background task). Without SMTP settings nothing is sent."""
    s = get_settings()
    if not s.smtp_host:
        if s.app_env == "development":  # dev convenience only: print the link so you can click it
            logger.warning("SMTP not configured. Email to %s:\n%s\n%s", to, subject, body)
        else:
            logger.error("SMTP not configured: email to %s was NOT sent", to)
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.smtp_from, to, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError):
        logger.exception("Failed to send email to %s", to)
