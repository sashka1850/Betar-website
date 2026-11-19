"""WSGI application for /price. Configure environment and serve behind HTTPS."""
import json
import os
import smtplib
import sqlite3
import ssl
import time
from email.message import EmailMessage
from email.utils import parseaddr
from pathlib import Path
from urllib.parse import parse_qs


def application(env, start_response):
    origin = os.environ.get("PRICE_ORIGIN")
    headers = [("Content-Type", "application/json"), ("Cache-Control", "no-store"), ("Vary", "Origin")]

    def reply(status):
        start_response(status, headers)
        return [json.dumps({"ok": status.startswith("200")}).encode()]

    if not origin or env.get("HTTP_ORIGIN") != origin:
        return reply("403 Forbidden")
    headers.append(("Access-Control-Allow-Origin", origin))
    if env["REQUEST_METHOD"] != "POST":
        return reply("405 Method Not Allowed")
    try:
        length = int(env.get("CONTENT_LENGTH") or 0)
    except ValueError:
        return reply("400 Bad Request")
    if not 0 < length <= 4096:
        return reply("400 Bad Request")
    fields = parse_qs(env["wsgi.input"].read(length).decode("utf-8", "replace"))
    email = fields.get("email", [""])[0].strip()
    city = fields.get("city", [""])[0].strip()
    if (not email.isascii() or len(email) > 254 or not city or len(city) > 100
            or any(ord(c) < 33 for c in email) or parseaddr(email)[1] != email
            or email.count("@") != 1 or "." not in email.split("@")[-1]):
        return reply("400 Bad Request")
    try:
        message = EmailMessage()
        message["From"] = os.environ["PRICE_FROM"]
        message["To"] = email
        message["Subject"] = "Оптовый прайс БЕТАР"
        message.set_content("Добрый день! Во вложении актуальный оптовый прайс БЕТАР.")
        message.add_attachment(Path(os.environ["PRICE_FILE"]).read_bytes(), maintype="application",
                               subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                               filename="BETAR-price.xlsx")
        with sqlite3.connect(os.environ["PRICE_DB"]) as db:
            db.execute("CREATE TABLE IF NOT EXISTS leads (email TEXT, city TEXT, created INTEGER, status TEXT)")
            db.execute("BEGIN IMMEDIATE")
            now = int(time.time())
            counts = db.execute("SELECT count(*),count(CASE WHEN email=? COLLATE NOCASE THEN 1 END) "
                                "FROM leads WHERE created>?", (email, now - 3600)).fetchone()
            if counts[0] >= 60 or counts[1] >= 2:
                return reply("429 Too Many Requests")
            lead = db.execute("INSERT INTO leads VALUES (?,?,?,?)", (email, city, now, "pending")).lastrowid
            db.commit()
            try:
                with smtplib.SMTP_SSL(os.environ["PRICE_SMTP_HOST"], int(os.getenv("PRICE_SMTP_PORT", "465")),
                                      timeout=12, context=ssl.create_default_context()) as smtp:
                    smtp.login(os.environ["PRICE_SMTP_USER"], os.environ["PRICE_SMTP_PASSWORD"])
                    smtp.send_message(message)
            except (OSError, smtplib.SMTPException, KeyError):
                db.execute("UPDATE leads SET status='unconfirmed' WHERE rowid=?", (lead,))
                return reply("503 Service Unavailable")
            db.execute("UPDATE leads SET status='sent' WHERE rowid=?", (lead,))
        return reply("200 OK")
    except (OSError, KeyError, ValueError, sqlite3.Error):
        return reply("503 Service Unavailable")
