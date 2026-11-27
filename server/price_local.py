"""Local HTTP server and maintenance commands for the price workflow."""
import argparse
import io
import os
import time
from email import policy
from email.parser import BytesParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .price_service import application, record_reply, send_follow_ups

ROOT = Path(__file__).resolve().parents[1]


class LocalHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/price":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400)
            return
        if not 0 < length <= 4096:
            self.send_error(400)
            return
        env = {
            "REQUEST_METHOD": "POST",
            "HTTP_ORIGIN": self.headers.get("Origin"),
            "CONTENT_LENGTH": str(length),
            "wsgi.input": io.BytesIO(self.rfile.read(length)),
        }

        def start_response(status, headers):
            self.send_response(int(status.split()[0]))
            for name, value in headers:
                self.send_header(name, value)
            self.end_headers()

        self.wfile.writelines(application(env, start_response))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, required=True)
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve")
    serve.add_argument("--port", type=int, default=8000)
    commands.add_parser("follow-up")
    reply = commands.add_parser("reply")
    reply.add_argument("file", type=Path)
    reply.add_argument("--received-at", type=int, default=None, help="Received time as Unix seconds")
    args = parser.parse_args()
    state = args.state.resolve()
    for folder in (state / "prices", state / "outbox"):
        folder.mkdir(parents=True, exist_ok=True)
    os.environ.update(PRICE_DB=str(state / "leads.sqlite3"), PRICE_DIRECTORY=str(state / "prices"),
                      PRICE_FROM="prices@example.test", PRICE_OUTBOX=str(state / "outbox"))

    if args.command == "serve":
        os.environ["PRICE_ORIGIN"] = f"http://127.0.0.1:{args.port}"
        handler = partial(LocalHandler, directory=ROOT / "dist")
        with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
            server.serve_forever()
    elif args.command == "reply":
        message = BytesParser(policy=policy.default).parsebytes(args.file.read_bytes())
        received_at = args.received_at if args.received_at is not None else int(time.time())
        print(record_reply(message, received_at))
    else:
        print(send_follow_ups())


if __name__ == "__main__":
    main()
