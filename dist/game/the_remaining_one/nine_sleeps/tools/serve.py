#!/usr/bin/env python3
"""Small static server for КЕРН · ДЕВЯТЬ СНОВ.

Serves the TiddlyWiki `files/` root so the game can stream the original album
tracks from `../../src/tracks/the_remaining_one/tracks/` without copying them.

Unlike `python -m http.server`, this supports HTTP Range requests, which
Chrome/Firefox need to seek inside an <audio> element.
"""

from __future__ import annotations

import argparse
import mimetypes
import os
import re
import socket
import sys
import threading
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GAME_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ROOT = GAME_DIR.parent.parent
GAME_URL = "/games/the_remaining_one/"

EXTRA_TYPES = {
    ".opus": "audio/ogg",
    ".ogg": "audio/ogg",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".m4a": "audio/mp4",
    ".wasm": "application/wasm",
}
for ext, mime in EXTRA_TYPES.items():
    mimetypes.add_type(mime, ext)

RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


class GameHandler(BaseHTTPRequestHandler):
    server_version = "KERN/1.0"
    protocol_version = "HTTP/1.1"

    root: Path = DEFAULT_ROOT

    def log_message(self, fmt: str, *args) -> None:
        # Keep the console readable: only errors and non-200 responses.
        status = args[1] if len(args) > 1 else ""
        if str(status).startswith(("4", "5")):
            sys.stderr.write("  %s %s\n" % (self.address_string(), fmt % args))

    def handle_error(self, request, client_address) -> None:
        # Browsers routinely reset idle audio connections; that is not an error.
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, TimeoutError)):
            return
        super().handle_error(request, client_address)

    def _resolve(self) -> Path | None:
        raw_path = self.path.split("?", 1)[0].split("#", 1)[0]
        from urllib.parse import unquote

        raw_path = unquote(raw_path)
        if raw_path in ("", "/"):
            raw_path = "/"
        if raw_path == "/":
            return None
        target = (self.root / raw_path.lstrip("/")).resolve()
        try:
            target.relative_to(self.root)
        except ValueError:
            return None
        return target

    def _send_text(self, status: HTTPStatus, text: str) -> None:
        data = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_HEAD(self) -> None:  # noqa: N802
        self._serve(head_only=True)

    def do_GET(self) -> None:  # noqa: N802
        self._serve(head_only=False)

    def _serve(self, head_only: bool) -> None:
        target = self._resolve()
        if target is None:
            self._send_text(HTTPStatus.NOT_FOUND, "not found\n")
            return
        if target.is_dir():
            index = target / "index.html"
            if index.is_file():
                target = index
            else:
                if not self.path.endswith("/"):
                    self.send_response(HTTPStatus.MOVED_PERMANENTLY)
                    self.send_header("Location", self.path + "/")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                self._send_text(HTTPStatus.NOT_FOUND, "directory listing disabled\n")
                return
        if not target.is_file():
            self._send_text(HTTPStatus.NOT_FOUND, "not found\n")
            return

        try:
            size = target.stat().st_size
            mtime = int(target.stat().st_mtime)
            f = target.open("rb")
        except OSError:
            self._send_text(HTTPStatus.NOT_FOUND, "not found\n")
            return

        with f:
            ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
            start, end = 0, size - 1
            status = HTTPStatus.OK
            range_header = self.headers.get("Range", "").strip()

            if range_header:
                m = RANGE_RE.match(range_header)
                if not m:
                    self._send_text(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "bad range\n")
                    return
                a, b = m.group(1), m.group(2)
                if a == "" and b == "":
                    self._send_text(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "bad range\n")
                    return
                if a == "":
                    # suffix range: last N bytes
                    length = int(b)
                    start = max(0, size - length)
                    end = size - 1
                else:
                    start = int(a)
                    end = int(b) if b else size - 1
                if start >= size or start > end:
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                end = min(end, size - 1)
                status = HTTPStatus.PARTIAL_CONTENT

            length = end - start + 1
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Last-Modified", self.date_time_string(mtime))
            if status == HTTPStatus.PARTIAL_CONTENT:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()

            if head_only:
                return
            f.seek(start)
            remaining = length
            chunk = 64 * 1024
            try:
                while remaining > 0:
                    data = f.read(min(chunk, remaining))
                    if not data:
                        break
                    self.wfile.write(data)
                    remaining -= len(data)
            except (BrokenPipeError, ConnectionResetError):
                pass


def find_port(host: str, preferred: int, tries: int = 20) -> int:
    for port in range(preferred, preferred + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind((host, port))
            except OSError:
                continue
            return port
    raise SystemExit(f"Не нашёл свободный порт рядом с {preferred}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Serve КЕРН · ДЕВЯТЬ СНОВ and the album tracks.")
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="files/ root (default: ../../ from game)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8778)
    ap.add_argument("--open", action="store_true", help="open the game in the default browser")
    args = ap.parse_args()

    root = args.root.resolve()
    index = root / "games/the_remaining_one/index.html"
    if not index.is_file():
        raise SystemExit(f"Не вижу игру: {index}\nУкажи --root на папку files/.")
    GameHandler.root = root

    port = find_port(args.host, args.port)
    httpd = ThreadingHTTPServer((args.host, port), GameHandler)
    httpd.daemon_threads = True
    url = f"http://{args.host}:{port}{GAME_URL}"

    print()
    print("  КЕРН · ДЕВЯТЬ СНОВ / THE REMAINING ONE")
    print(f"  {url}")
    print(f"  root: {root}")
    print("  Ctrl+C — остановить")
    print()
    sys.stdout.flush()

    if args.open:
        threading.Timer(0.45, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  остановлено")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
