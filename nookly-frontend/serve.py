#!/usr/bin/env python3
"""Nookly frontend dev server.

Same as `python3 -m http.server`, but sends Cache-Control: no-cache so a
browser always revalidates HTML/CSS/JS/images and picks up edits immediately
instead of reusing a stale copy.
"""
import functools
import http.server
import socketserver

PORT = 8080
HOST = "127.0.0.1"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    with ThreadingHTTPServer((HOST, PORT), NoCacheHandler) as httpd:
        httpd.serve_forever()