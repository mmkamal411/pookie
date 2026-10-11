"""HTTP transport layer.

Hard-won lesson baked in: Python ``urllib`` POSTs to some endpoints get 403
unless a curl-style User-Agent is sent. Every request from this package
therefore carries a browser-like UA header, and every error surfaces the
status code plus a body snippet so failures are debuggable from the log.
"""

import json
import urllib.error
import urllib.request

# Curl-style UA — the 403 lesson. Swapped per-platform by the entry points.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0 Safari/537.36"
)


class TransportError(RuntimeError):
    """HTTP request failed. Carries status + body snippet for the log."""

    def __init__(self, method, url, status, body):
        self.method = method
        self.url = url
        self.status = status
        self.body = (body or "")[:500]
        super().__init__(f"{method} {url} -> HTTP {status}: {self.body}")


def http_request(method, url, headers=None, data=None, timeout=30):
    """Send one HTTP request. Returns parsed JSON (or None on empty body)."""
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    req_headers = {"User-Agent": USER_AGENT}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return json.loads(body) if body.strip() else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise TransportError(method, url, e.code, err_body) from e
    except urllib.error.URLError as e:
        raise TransportError(method, url, "connection", str(e)) from e
