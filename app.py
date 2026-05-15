import os
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def write_supabase_config(root_dir: Path):
    url = os.environ.get("CF_SUPABASE_URL", "").strip()
    anon_key = os.environ.get("CF_SUPABASE_ANON_KEY", "").strip()
    login_email = os.environ.get("CF_LOGIN_EMAIL", "").strip()
    login_alias = os.environ.get("CF_LOGIN_ALIAS", "BKJ").strip() or "BKJ"

    if not (url and anon_key and login_email):
        return

    cfg_file = root_dir / "supabase-config.js"
    cfg_file.write_text(
        "\n".join(
            [
                "window.CF_SUPABASE = {",
                f'  url: "{url}",',
                f'  anonKey: "{anon_key}",',
                f'  loginAlias: "{login_alias}",',
                f'  loginEmail: "{login_email}"',
                "}",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main():
    root_dir = Path(os.environ.get("ROOT_DIR", "dashboard-spa")).resolve()
    write_supabase_config(root_dir)

    port = int(os.environ.get("PORT", "8080"))
    handler = partial(NoCacheHandler, directory=str(root_dir))
    httpd = ThreadingHTTPServer(("0.0.0.0", port), handler)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
