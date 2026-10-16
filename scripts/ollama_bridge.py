"""Let the live site reach Ollama without changing Ollama's own settings.

Ollama rejects browser requests from websites it doesn't know (its
OLLAMA_ORIGINS setting). This bridge listens on localhost:11435, accepts
requests only from the origins below, and forwards them to Ollama on
localhost:11434 without the website's Origin header, so Ollama allows them.
Useful when Ollama runs under another macOS account whose settings you can't
change. Standard library only.

    python3 scripts/ollama_bridge.py
"""
import http.client
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN_PORT = 11435
OLLAMA_HOST, OLLAMA_PORT = "127.0.0.1", 11434
ALLOWED = re.compile(r"^(https://sherrrrryz\.github\.io|http://(localhost|127\.0\.0\.1)(:\d+)?)$")
HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "host", "origin", "referer"}


class Bridge(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def cors(self):
        origin = self.headers.get("Origin", "")
        if ALLOWED.match(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        return bool(ALLOWED.match(origin)) or not origin

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def forward(self):
        origin = self.headers.get("Origin", "")
        if origin and not ALLOWED.match(origin):
            self.send_response(403)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP}
        try:
            conn = http.client.HTTPConnection(OLLAMA_HOST, OLLAMA_PORT, timeout=600)
            conn.request(self.command, self.path, body=body or None, headers=headers)
            resp = conn.getresponse()
        except OSError as e:
            msg = f"Can't reach Ollama on port {OLLAMA_PORT}: {e}".encode()
            self.send_response(502)
            self.cors()
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return
        self.send_response(resp.status)
        self.cors()
        for k, v in resp.getheaders():
            if k.lower() not in HOP and k.lower() != "content-length" and not k.lower().startswith("access-control-"):
                self.send_header(k, v)
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        # Stream chunk by chunk so answers appear word by word.
        while chunk := resp.read1(65536):
            self.wfile.write(b"%x\r\n%s\r\n" % (len(chunk), chunk))
            self.wfile.flush()
        self.wfile.write(b"0\r\n\r\n")
        conn.close()

    do_GET = do_POST = forward

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Ollama bridge on http://localhost:{LISTEN_PORT} -> {OLLAMA_HOST}:{OLLAMA_PORT}. Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", LISTEN_PORT), Bridge).serve_forever()
