#!/usr/bin/env python3
"""Revisa cada cierto tiempo la bandeja de entrada de Proton Mail (vía Proton Mail Bridge)
e imprime los correos nuevos.

Variables de entorno:
  PROTON_USER      tu dirección de Proton
  PROTON_PASS      la contraseña que muestra Bridge (NO la de tu cuenta Proton)
  PROTON_HOST      por defecto 127.0.0.1
  PROTON_PORT      por defecto 1143 (IMAP de Bridge, STARTTLS)
  INTERVALO        segundos entre revisiones, por defecto 60
"""
import email
import imaplib
import os
import ssl
import time
from email.header import decode_header, make_header

HOST = os.environ.get("PROTON_HOST", "127.0.0.1")
PORT = int(os.environ.get("PROTON_PORT", "1143"))
USER = os.environ["PROTON_USER"]
PASS = os.environ["PROTON_PASS"]
INTERVALO = int(os.environ.get("INTERVALO", "60"))


def conectar():
    imap = imaplib.IMAP4(HOST, PORT)
    # Bridge usa un certificado autofirmado en localhost
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    imap.starttls(ssl_context=ctx)
    imap.login(USER, PASS)
    imap.select("INBOX", readonly=True)
    return imap


def uids(imap):
    _, data = imap.uid("search", None, "ALL")
    return set(data[0].split())


def cabecera(valor):
    return str(make_header(decode_header(valor or "")))


def imprimir(imap, uid):
    _, data = imap.uid("fetch", uid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
    msg = email.message_from_bytes(data[0][1])
    print(f"📬 Nuevo correo de {cabecera(msg['From'])}: {cabecera(msg['Subject'])} ({msg['Date']})", flush=True)


def main():
    imap = conectar()
    vistos = uids(imap)
    print(f"Vigilando {USER} cada {INTERVALO}s ({len(vistos)} correos ya en la bandeja)", flush=True)
    while True:
        time.sleep(INTERVALO)
        try:
            imap.noop()
            actuales = uids(imap)
        except (imaplib.IMAP4.abort, OSError):
            imap = conectar()
            actuales = uids(imap)
        for uid in sorted(actuales - vistos, key=int):
            imprimir(imap, uid)
        vistos = actuales


if __name__ == "__main__":
    main()
