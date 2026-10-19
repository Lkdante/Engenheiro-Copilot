"""Testa o envio de e-mail com os dados do .env. Rode pelo testar-email.bat.

Mostra em qual etapa falha (conexão, criptografia, login ou envio) e salva o
resultado em data/teste-email.log.
"""
import smtplib
import ssl
import sys
import traceback
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

base = Path(__file__).parent
(base / "data").mkdir(exist_ok=True)
log = open(base / "data" / "teste-email.log", "w", encoding="utf-8")


def out(*partes):
    texto = " ".join(str(p) for p in partes)
    print(texto)
    log.write(texto + "\n")
    log.flush()


env = {}
for linha in (base / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in linha and not linha.strip().startswith("#"):
        chave, valor = linha.split("=", 1)
        env[chave.strip()] = valor.strip()

host, user, senha = env.get("SMTP_HOST", ""), env.get("SMTP_USER", ""), env.get("SMTP_PASSWORD", "")
para = sys.argv[1] if len(sys.argv) > 1 else user
out(f"Horario: {datetime.now():%d/%m/%Y %H:%M:%S}")
out(f"Servidor: {host} | Usuario: {user} | Senha: {len(senha)} caracteres | Para: {para}")

try:
    with smtplib.SMTP(host, int(env.get("SMTP_PORT") or 587), timeout=20) as smtp:
        out("1/4 Conectou ao servidor do Gmail")
        smtp.starttls(context=ssl.create_default_context())
        out("2/4 Conexao criptografada")
        smtp.login(user, senha)
        out("3/4 Login aceito")
        msg = EmailMessage()
        msg["From"] = env.get("SMTP_FROM") or user
        msg["To"] = para
        msg["Subject"] = "Teste Engenheiro Copilot"
        msg.set_content(f"Se chegou, o envio de e-mails funciona! ({datetime.now():%d/%m %H:%M})")
        smtp.send_message(msg)
        out(f"4/4 E-MAIL ENVIADO para {para}")
except smtplib.SMTPAuthenticationError as e:
    out("LOGIN RECUSADO:", e.smtp_code, e.smtp_error.decode(errors="ignore"))
except Exception as e:
    out("ERRO:", type(e).__name__, e)
    log.write(traceback.format_exc())
log.close()
