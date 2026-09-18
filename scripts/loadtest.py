#!/usr/bin/env python3
"""Concurrent load test — stdlib only, no deps.

Fires N requests at CONCURRENCY parallel connections against a URL and reports
throughput + latency percentiles + status distribution. Use it to prove the
static site survives 300 concurrent users on the 1GB VPS.

    python3 scripts/loadtest.py https://hub.robotku.id/cek/ -c 300 -n 3000
    python3 scripts/loadtest.py http://127.0.0.1:8080/ -c 300 -d 15   # 15s soak

For a real 300-user check, hit a few heavy paths, not just /:
    for p in / /cek/ /control/ /_next/static/ ; do \
        python3 scripts/loadtest.py "$BASE$p" -c 300 -n 2000; done

Self-test (no server needed):  python3 scripts/loadtest.py --selfcheck
"""
from __future__ import annotations
import argparse, sys, time, ssl, http.client
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE  # load test, not a security audit — accept self-signed


def _fetch(url: str, timeout: float) -> tuple[int, int, float]:
    """Return (status, bytes, seconds). status 0 == connection/transport error."""
    u = urlparse(url)
    host, port = u.hostname, u.port
    t0 = time.perf_counter()
    try:
        if u.scheme == "https":
            conn = http.client.HTTPSConnection(host, port or 443, timeout=timeout, context=_SSL)
        else:
            conn = http.client.HTTPConnection(host, port or 80, timeout=timeout)
        path = u.path or "/"
        if u.query:
            path += "?" + u.query
        conn.request("GET", path, headers={"Accept-Encoding": "gzip, br", "Connection": "close"})
        r = conn.getresponse()
        body = r.read()
        conn.close()
        return r.status, len(body), time.perf_counter() - t0
    except Exception:
        return 0, 0, time.perf_counter() - t0


def _pct(sorted_ms: list[float], p: float) -> float:
    if not sorted_ms:
        return 0.0
    i = min(len(sorted_ms) - 1, int(round(p / 100 * (len(sorted_ms) - 1))))
    return sorted_ms[i]


def run(url: str, concurrency: int, total: int | None, duration: float | None,
        timeout: float) -> dict:
    lat: list[float] = []
    codes: dict[int, int] = {}
    total_bytes = 0
    wall0 = time.perf_counter()

    def record(res):
        nonlocal total_bytes
        status, nbytes, secs = res
        lat.append(secs * 1000.0)
        codes[status] = codes.get(status, 0) + 1
        total_bytes += nbytes

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        if duration:  # soak: keep the pool saturated until time runs out
            deadline = wall0 + duration
            inflight = {pool.submit(_fetch, url, timeout) for _ in range(concurrency)}
            while inflight:
                done = next(as_completed(inflight))
                inflight.discard(done)
                record(done.result())
                if time.perf_counter() < deadline:
                    inflight.add(pool.submit(_fetch, url, timeout))
        else:  # fixed count
            futs = [pool.submit(_fetch, url, timeout) for _ in range(total or 0)]
            for f in as_completed(futs):
                record(f.result())

    wall = time.perf_counter() - wall0
    lat.sort()
    ok = sum(n for c, n in codes.items() if 200 <= c < 400)
    return {
        "url": url, "concurrency": concurrency, "requests": len(lat), "wall_s": wall,
        "rps": len(lat) / wall if wall else 0.0,
        "ok": ok, "failed": len(lat) - ok, "codes": codes,
        "mb": total_bytes / 1048576.0,
        "p50": _pct(lat, 50), "p90": _pct(lat, 90),
        "p95": _pct(lat, 95), "p99": _pct(lat, 99), "max": lat[-1] if lat else 0.0,
    }


def report(r: dict) -> None:
    print(f"\n  {r['url']}  (c={r['concurrency']})")
    print(f"  requests   {r['requests']}  in {r['wall_s']:.2f}s   ->  {r['rps']:.0f} req/s")
    print(f"  status     ok={r['ok']}  failed={r['failed']}  codes={r['codes']}")
    print(f"  transfer   {r['mb']:.1f} MB")
    print(f"  latency    p50={r['p50']:.0f}ms  p90={r['p90']:.0f}ms  "
          f"p95={r['p95']:.0f}ms  p99={r['p99']:.0f}ms  max={r['max']:.0f}ms")
    verdict = "PASS" if r["failed"] == 0 else "FAIL (dropped requests)"
    print(f"  verdict    {verdict}\n")


def _selfcheck() -> None:
    """Spin a throwaway static server, hammer it at c=50, assert 0 drops."""
    import http.server, socketserver, threading, tempfile, os
    d = tempfile.mkdtemp()
    with open(os.path.join(d, "index.html"), "w") as f:
        f.write("<h1>ok</h1>" * 100)

    class Q(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=d, **k)
        def log_message(self, *a):
            pass

    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Q)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    r = run(f"http://127.0.0.1:{port}/", concurrency=50, total=500, duration=None, timeout=5)
    srv.shutdown()
    report(r)
    assert r["requests"] == 500, r["requests"]
    assert r["failed"] == 0, f"drops: {r['failed']}"
    assert r["rps"] > 0 and r["p95"] >= 0
    print("selfcheck OK")


def main() -> None:
    ap = argparse.ArgumentParser(description="stdlib concurrent load test")
    ap.add_argument("url", nargs="?", help="target URL")
    ap.add_argument("-c", "--concurrency", type=int, default=50)
    ap.add_argument("-n", "--requests", type=int, default=1000)
    ap.add_argument("-d", "--duration", type=float, default=None, help="soak seconds (overrides -n)")
    ap.add_argument("--timeout", type=float, default=30.0)
    ap.add_argument("--selfcheck", action="store_true")
    a = ap.parse_args()
    if a.selfcheck:
        _selfcheck()
        return
    if not a.url:
        ap.error("url required (or --selfcheck)")
    r = run(a.url, a.concurrency, a.requests, a.duration, a.timeout)
    report(r)
    sys.exit(0 if r["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
