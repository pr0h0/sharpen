"""Static server for the web build. Sends Cache-Control: no-cache so browsers revalidate
every file (cheap 304s) and always pick up a fresh build from tools/build.sh.

Usage: python3 tools/serve.py [port] [host] [dir]   (defaults: 4956 0.0.0.0 dist)
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "dist"


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 4956
host = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"
if len(sys.argv) > 3:
    ROOT = pathlib.Path(sys.argv[3]).resolve()
http.server.ThreadingHTTPServer((host, port), functools.partial(Handler, directory=str(ROOT))).serve_forever()
