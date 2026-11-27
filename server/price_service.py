"""Price requests, outbound mail and lead status tracking."""
import json
import mimetypes
import os
import re
import smtplib
import sqlite3
import ssl
import time
import tomllib
from contextlib import closing, contextmanager
from email.message import EmailMessage
from email.utils import formatdate, getaddresses, make_msgid
from pathlib import Path
from urllib.parse import parse_qs

SERVER = Path(__file__).resolve().parent
EMAIL = re.compile(r"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+")
MESSAGE_ID = re.compile(r"<[^<>\s]+>")


@contextmanager
def database():
    with closing(sqlite3.connect(os.environ["PRICE_DB"], timeout=30)) as db, db:
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS price_requests (
            email TEXT PRIMARY KEY COLLATE NOCASE, region TEXT NOT NULL,
            sent_at INTEGER NOT NULL, status TEXT NOT NULL,
            status_at INTEGER NOT NULL, price_id TEXT NOT NULL,
            follow_up_id TEXT, follow_up_at INTEGER
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS price_send_log (
            email TEXT COLLATE NOCASE, sent_at INTEGER NOT NULL
        )""")
        db.execute("BEGIN IMMEDIATE")
        yield db


def deliver(email, follow_up=False, price_id=None):
    files = [p for p in Path(os.environ["PRICE_DIRECTORY"]).iterdir()
             if p.is_file() and not p.name.startswith((".", "~$"))]
    if len(files) != 1:
        raise ValueError("PRICE_DIRECTORY must contain exactly one price file")
    attachment = files[0]
    message = EmailMessage()
    message["From"] = os.environ["PRICE_FROM"]
    message["Reply-To"] = os.environ.get("PRICE_REPLY_TO", os.environ["PRICE_FROM"])
    message["To"] = email
    message["Date"] = formatdate()
    message["Message-ID"] = make_msgid(domain=getaddresses([message["From"]])[0][1].split("@")[-1])
    message["Subject"] = "Re: Оптовый прайс БЕТАР" if follow_up else "Оптовый прайс БЕТАР"
    if follow_up:
        message["In-Reply-To"] = price_id
        message["References"] = price_id
    template = "follow_up.txt" if follow_up else "price.txt"
    message.set_content((SERVER / "mail" / template).read_text(encoding="utf-8"))
    mime = mimetypes.guess_type(attachment.name)[0] or "application/octet-stream"
    message.add_attachment(attachment.read_bytes(), *mime.split("/"), filename=attachment.name)
    outbox = os.environ.get("PRICE_OUTBOX")
    if outbox:
        with (Path(outbox) / (message["Message-ID"][1:-1] + ".eml")).open("xb") as file:
            file.write(message.as_bytes())
    else:
        with smtplib.SMTP_SSL(os.environ["PRICE_SMTP_HOST"], int(os.getenv("PRICE_SMTP_PORT", "465")),
                              timeout=12, context=ssl.create_default_context()) as smtp:
            smtp.login(os.environ["PRICE_SMTP_USER"], os.environ["PRICE_SMTP_PASSWORD"])
            refused = smtp.send_message(message)
            if refused:
                raise smtplib.SMTPRecipientsRefused(refused)
    return str(message["Message-ID"])


def send_price(email, region):
    with database() as db:
        cutoff = int(time.time()) - 3600
        db.execute("DELETE FROM price_send_log WHERE sent_at <= ?", (cutoff,))
        total, for_email = db.execute("""SELECT count(*),
            count(CASE WHEN email = ? THEN 1 END) FROM price_send_log""", (email,)).fetchone()
        if total >= 60 or for_email >= 2:
            return False
        message_id = deliver(email)
        now = int(time.time())
        db.execute("""INSERT INTO price_requests VALUES (?, ?, ?, 'sent', ?, ?, NULL, NULL)
            ON CONFLICT(email) DO UPDATE SET region=excluded.region, sent_at=excluded.sent_at,
            status='sent', status_at=excluded.status_at, price_id=excluded.price_id,
            follow_up_id=NULL, follow_up_at=NULL""", (email, region, now, now, message_id))
        db.execute("INSERT INTO price_send_log VALUES (?, ?)", (email, now))
    return True


def send_follow_ups():
    settings_path = Path(os.environ.get("PRICE_SETTINGS", SERVER / "price_settings.toml"))
    with settings_path.open("rb") as file:
        settings = tomllib.load(file)
    enabled, days = settings["follow_up_enabled"], settings["follow_up_delay_days"]
    if type(enabled) is not bool or type(days) is not int or days < 1:
        raise ValueError("Expected a boolean switch and a positive day count")
    if not enabled:
        return 0
    with database() as db:
        cutoff = int(time.time()) - days * 86400
        emails = [row["email"] for row in db.execute(
            "SELECT email FROM price_requests WHERE status='sent' AND status_at < ?", (cutoff,))]
    count = 0
    for email in emails:
        with database() as db:
            row = db.execute("""SELECT * FROM price_requests WHERE email=? AND status='sent'
                              AND status_at < ?""", (email, cutoff)).fetchone()
            if not row:
                continue
            message_id = deliver(email, follow_up=True, price_id=row["price_id"])
            now = int(time.time())
            db.execute("""UPDATE price_requests SET status='follow_up', status_at=?,
                follow_up_at=?, follow_up_id=? WHERE email=?""", (now, now, message_id, email))
            count += 1
    return count


def record_reply(message, received_at):
    senders = getaddresses(message.get_all("From", []))
    if len(senders) != 1:
        return "review"
    sender = senders[0][1]
    if (not EMAIL.fullmatch(sender) or message.get("Return-Path") == "<>"
            or message.get("Auto-Submitted", "no").lower() != "no"
            or message.get("Precedence", "").lower() in {"bulk", "list", "junk"}
            or message.get("List-Id") or message.get_content_type() == "multipart/report"):
        return "ignored"
    headers = " ".join(message.get_all("In-Reply-To", []) + message.get_all("References", []))
    references = set(MESSAGE_ID.findall(headers))
    with database() as db:
        row = db.execute("SELECT * FROM price_requests WHERE email=?", (sender,)).fetchone()
        if not row or received_at < row["sent_at"]:
            return "review"
        if references and not references.intersection({row["price_id"], row["follow_up_id"]}):
            return "review"
        if row["status"] in {"replied", "replied_after_follow_up"}:
            return "already_recorded"
        status = "replied"
        if row["follow_up_at"] and received_at >= row["follow_up_at"]:
            status = "replied_after_follow_up"
        db.execute("UPDATE price_requests SET status=?, status_at=? WHERE email=?",
                   (status, received_at, sender))
    return status


def application(env, start_response):
    origin = os.environ.get("PRICE_ORIGIN")
    headers = [("Content-Type", "application/json"), ("Cache-Control", "no-store"), ("Vary", "Origin")]

    def reply(status, ok=False):
        start_response(status, headers)
        return [json.dumps({"ok": ok}).encode()]

    if not origin or env.get("HTTP_ORIGIN") != origin:
        return reply("403 Forbidden")
    headers.append(("Access-Control-Allow-Origin", origin))
    if env["REQUEST_METHOD"] != "POST":
        return reply("405 Method Not Allowed")
    try:
        length = int(env.get("CONTENT_LENGTH") or 0)
        if not 0 < length <= 4096:
            return reply("400 Bad Request")
        fields = parse_qs(env["wsgi.input"].read(length).decode("utf-8"), strict_parsing=True)
    except ValueError:
        return reply("400 Bad Request")
    email = fields.get("email", [""])[0].strip()
    region = fields.get("region", [""])[0].strip()
    if len(email) > 254 or not EMAIL.fullmatch(email) or len(region) > 100:
        return reply("400 Bad Request")
    try:
        if not send_price(email, region):
            return reply("429 Too Many Requests")
    except (OSError, KeyError, ValueError, sqlite3.Error, smtplib.SMTPException):
        return reply("503 Service Unavailable")
    return reply("200 OK", ok=True)
