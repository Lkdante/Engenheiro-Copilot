"""Envio de e-mails e checagem do domínio de e-mail.

- Com SMTP configurado no .env (SMTP_HOST, SMTP_USER, SMTP_PASSWORD), envia de verdade.
- Sem SMTP ("modo dev"), só imprime o e-mail no terminal do backend. Assim dá pra
  testar todos os fluxos sem depender de nenhum provedor.
"""
from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger("emailer")

# Últimos e-mails "enviados" (os testes leem daqui para pegar o link com o token)
SENT = []


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST", "").strip())


def send_email(to: str, subject: str, body: str) -> None:
    SENT.append({"to": to, "subject": subject, "body": body})
    del SENT[:-50]  # guarda só os 50 últimos

    if not smtp_configured() or to.lower().endswith("@demo.com"):
        logger.info("\n===== E-MAIL (modo dev, não enviado) =====\nPara: %s\nAssunto: %s\n\n%s\n==========================================",
                    to, subject, body)
        return

    user = os.environ.get("SMTP_USER", "")
    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_FROM") or user
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", 587)), timeout=20) as smtp:
            smtp.starttls(context=ssl.create_default_context())  # criptografa a conexão
            if user:
                smtp.login(user, os.environ.get("SMTP_PASSWORD", ""))
            smtp.send_message(msg)
        logger.info("E-mail enviado para %s (%s)", to, subject)
    except Exception:
        # Falha no e-mail não pode derrubar o cadastro/login: só registra no log.
        logger.exception("Falha ao enviar e-mail para %s", to)


def email_domain_exists(email: str) -> bool:
    """Confere no DNS se o domínio do e-mail recebe mensagens (registro MX).

    Pega erros de digitação como 'gmial.com'. NÃO garante que a caixa exista:
    isso só a confirmação por link garante.
    """
    if os.environ.get("CHECK_EMAIL_DOMAIN", "true").lower() not in ("1", "true", "yes"):
        return True
    try:
        import dns.exception
        import dns.resolver
    except ImportError:
        return True  # biblioteca não instalada: não bloqueia ninguém

    domain = email.rsplit("@", 1)[-1]
    try:
        dns.resolver.resolve(domain, "MX", lifetime=5)
        return True
    except dns.resolver.NXDOMAIN:
        # "Não existe". Mas antes de acreditar, confere se o DNS da rede funciona:
        # algumas redes bloqueadas respondem "não existe" para qualquer domínio.
        try:
            dns.resolver.resolve("gmail.com", "MX", lifetime=5)
        except dns.exception.DNSException:
            return True  # DNS quebrado: não dá pra saber, então não bloqueia
        return False  # o DNS funciona e o domínio realmente não existe
    except dns.resolver.NoAnswer:
        # Sem MX: pelas regras do e-mail, o servidor pode usar o registro A do domínio
        try:
            dns.resolver.resolve(domain, "A", lifetime=5)
            return True
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return False  # nem MX nem A: o domínio não recebe e-mail
        except dns.exception.DNSException:
            return True  # erro de rede no meio da consulta: não bloqueia
    except dns.exception.DNSException:
        return True  # sem internet ou DNS lento: na dúvida, não bloqueia