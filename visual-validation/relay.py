#!/usr/bin/env python3
"""Local unauthenticated forward proxy -> authenticated upstream egress proxy.

Chromium waits for a 407 challenge before sending Proxy-Authorization, but the
sandbox egress proxy drops unauthenticated CONNECTs outright. This relay
injects the Proxy-Authorization header preemptively (like curl does).
Credentials come from the HTTPS_PROXY env var; nothing is hardcoded.
"""
import base64
import os
import socket
import threading
import urllib.parse

LISTEN = ("127.0.0.1", 18080)


def get_upstream():
    u = urllib.parse.urlparse(os.environ["HTTPS_PROXY"])
    creds = base64.b64encode(f"{u.username}:{u.password}".encode()).decode()
    return u.hostname, u.port, creds


def relay(a, b):
    try:
        while True:
            data = a.recv(65536)
            if not data:
                break
            b.sendall(data)
    except OSError:
        pass
    finally:
        for s in (a, b):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            s.close()


def handle(client):
    upstream_host, upstream_port, creds = get_upstream()
    try:
        # Read request head
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = client.recv(4096)
            if not chunk:
                client.close()
                return
            buf += chunk
        head, _, rest = buf.partition(b"\r\n\r\n")
        lines = head.decode("latin1").split("\r\n")
        method, target = lines[0].split(" ")[:2]

        up = socket.create_connection((upstream_host, upstream_port), timeout=20)
        auth = f"Proxy-Authorization: Basic {creds}\r\n"
        if method.upper() == "CONNECT":
            up.sendall(f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n{auth}\r\n".encode())
            # Read CONNECT response status
            resp = b""
            while b"\r\n\r\n" not in resp:
                chunk = up.recv(4096)
                if not chunk:
                    break
                resp += chunk
            if b" 200" not in resp.split(b"\r\n", 1)[0]:
                client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                client.close()
                up.close()
                return
            client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            if rest:
                up.sendall(rest)
        else:
            # Plain HTTP: forward absolute-URI request with auth injected
            out_lines = [lines[0]]
            for ln in lines[1:]:
                if not ln.lower().startswith("proxy-authorization:"):
                    out_lines.append(ln)
            out_lines.append(auth.strip())
            up.sendall(("\r\n".join(out_lines) + "\r\n\r\n").encode() + rest)
        t1 = threading.Thread(target=relay, args=(client, up), daemon=True)
        t2 = threading.Thread(target=relay, args=(up, client), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    except Exception:
        try:
            client.close()
        except OSError:
            pass


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(LISTEN)
    srv.listen(50)
    print(f"relay listening on {LISTEN[0]}:{LISTEN[1]}", flush=True)
    while True:
        client, _ = srv.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()


if __name__ == "__main__":
    main()
