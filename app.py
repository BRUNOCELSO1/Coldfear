import os
import mimetypes
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial


def get_build_id() -> str:
    for k in [
        "RAILWAY_GIT_COMMIT_SHA",
        "RAILWAY_DEPLOYMENT_ID",
        "GITHUB_SHA",
        "VERCEL_GIT_COMMIT_SHA",
    ]:
        v = (os.environ.get(k) or "").strip()
        if v:
            return v[:12]
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


BUILD_ID = get_build_id()


def supabase_config_js() -> Optional[str]:
    url = os.environ.get("CF_SUPABASE_URL", "").strip()
    anon_key = os.environ.get("CF_SUPABASE_ANON_KEY", "").strip()
    login_email = os.environ.get("CF_LOGIN_EMAIL", "").strip()
    login_alias = os.environ.get("CF_LOGIN_ALIAS", "BKJ").strip() or "BKJ"
    if not (url and anon_key and login_email):
        return None
    return "\n".join(
        [
            "window.CF_SUPABASE = {",
            f'  url: "{url}",',
            f'  anonKey: "{anon_key}",',
            f'  loginAlias: "{login_alias}",',
            f'  loginEmail: "{login_email}"',
            "}",
            "",
        ]
    )


class AppHandler(SimpleHTTPRequestHandler):
    build_id = BUILD_ID

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_text(self, status: int, body: str, content_type: str):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_bytes(self, status: int, body: bytes, content_type: str):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_index(self):
        index_path = Path(self.directory) / "index.html"
        if not index_path.exists():
            return self._send_text(404, "Not found", "text/plain; charset=utf-8")

        html = index_path.read_text(encoding="utf-8")
        html = re.sub(
            r"\./styles\.css(?:\?v=[^\"']+)?",
            f"./styles.css?v={self.build_id}",
            html,
        )
        html = re.sub(
            r"\./app\.js(?:\?v=[^\"']+)?",
            f"./app.js?v={self.build_id}",
            html,
        )
        html = html.replace(
            '<span id="build-id"></span>',
            f'<span id="build-id">build-{self.build_id}</span>',
        )
        return self._send_text(200, html, "text/html; charset=utf-8")

    def do_GET(self):
        parsed = urlparse(self.path)
        pathname = parsed.path or "/"

        if pathname == "/health":
            return self._send_text(200, "ok", "text/plain; charset=utf-8")

        if pathname in ["/", "/index.html"]:
            return self._serve_index()

        if pathname == "/supabase-config.js":
            js = supabase_config_js()
            if js is None:
                return self._send_text(
                    404,
                    "/* missing CF_SUPABASE env vars */\n",
                    "application/javascript; charset=utf-8",
                )
            return self._send_text(200, js, "application/javascript; charset=utf-8")

        abs_path = (Path(self.directory) / pathname.lstrip("/")).resolve()
        base = Path(self.directory).resolve()
        if base not in abs_path.parents and abs_path != base:
            return self._send_text(403, "Forbidden", "text/plain; charset=utf-8")

        if not abs_path.exists() or not abs_path.is_file():
            return self._send_text(404, "Not found", "text/plain; charset=utf-8")

        ctype, _ = mimetypes.guess_type(str(abs_path))
        ctype = ctype or "application/octet-stream"
        return self._send_bytes(200, abs_path.read_bytes(), ctype)


def main():
    root_dir = Path(os.environ.get("ROOT_DIR", "dashboard-spa")).resolve()
    port = int(os.environ.get("PORT", "8080"))
    handler = partial(AppHandler, directory=str(root_dir))
    httpd = ThreadingHTTPServer(("0.0.0.0", port), handler)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
