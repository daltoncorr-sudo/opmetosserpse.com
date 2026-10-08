#!/usr/bin/env python3
"""Preview docs/ the way GitHub Pages serves it: /projects/sunnys-bookshop -> projects/sunnys-bookshop.html.
    python3 serve.py            # http://127.0.0.1:8080/
"""
import http.server, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docs')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def send_head(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        full = os.path.join(ROOT, path.lstrip('/'))
        if not os.path.exists(full) and os.path.exists(full + '.html'):
            self.path = path + '.html'
        elif not os.path.exists(full) and not path.endswith('/'):
            self.send_response(404); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.end_headers()
            return open(os.path.join(ROOT, '404.html'), 'rb')
        return super().send_head()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
print('Serving http://127.0.0.1:%d/' % port)
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
