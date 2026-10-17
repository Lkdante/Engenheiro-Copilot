import os

os.environ["CHECK_EMAIL_DOMAIN"] = "false"  # não consulta o DNS durante os testes
os.environ["SMTP_HOST"] = ""                # nunca envia e-mail de verdade nos testes