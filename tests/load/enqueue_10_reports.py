"""Submit and verify ten concurrent program-report jobs.

Required environment: BASE_URL, JWT_TOKEN. Optional: REPORT_TIMEOUT_SECONDS (default 120).
Writes docs/evidence/load-tests/results/reports_10_parallel.json.
"""
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener

BASE_URL = os.environ.get("BASE_URL", "").rstrip("/")
TOKEN = os.environ.get("JWT_TOKEN", "")
TIMEOUT = int(os.environ.get("REPORT_TIMEOUT_SECONDS", "120"))
OUTPUT = Path("docs/evidence/load-tests/results/reports_10_parallel.json")
OPENER = build_opener(ProxyHandler({}))

def request(path, method="GET", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(f"{BASE_URL}{path}", data=data, method=method, headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with OPENER.open(req, timeout=20) as response:
        return json.loads(response.read())

def submit(_: int):
    return request("/api/reports/jobs", "POST", {"format": "JSON", "filter": {}, "columns": ["organization", "direction", "product", "status"]})["id"]

def overlap(jobs):
    events = []
    for job in jobs:
        if job.get("started_at") and job.get("finished_at"):
            events += [(datetime.fromisoformat(job["started_at"].replace("Z", "+00:00")), 1), (datetime.fromisoformat(job["finished_at"].replace("Z", "+00:00")), -1)]
    current = maximum = 0
    for _, delta in sorted(events, key=lambda item: (item[0], -item[1])):
        current += delta; maximum = max(maximum, current)
    return maximum

def main():
    if not BASE_URL or not TOKEN:
        raise RuntimeError("BASE_URL and JWT_TOKEN are required")
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=10) as pool:
        job_ids = list(pool.map(submit, range(10)))
    pending = set(job_ids); jobs = {}
    while pending and time.monotonic() - started < TIMEOUT:
        for job_id in list(pending):
            job = request(f"/api/reports/jobs/{job_id}")
            jobs[job_id] = job
            if job["status"] in {"DONE", "FAILED"}:
                pending.remove(job_id)
        if pending: time.sleep(0.5)
    records = [jobs.get(job_id, {"id": job_id, "status": "LOST"}) for job_id in job_ids]
    max_running = overlap(records)
    summary = {"test": "10 parallel reports", "submitted": len(job_ids), "done": sum(j.get("status") == "DONE" for j in records), "failed": sum(j.get("status") == "FAILED" for j in records), "lost": sum(j.get("status") == "LOST" for j in records), "max_concurrently_running": max_running, "duration_seconds": round(time.monotonic() - started, 3), "jobs": records}
    summary["result"] = "PASS" if summary["done"] == 10 and not summary["failed"] and not summary["lost"] and max_running >= 10 else "FAIL"
    OUTPUT.parent.mkdir(parents=True, exist_ok=True); OUTPUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2)); return 0 if summary["result"] == "PASS" else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps({"test": "10 parallel reports", "result": "FAIL", "startup_error": str(error)}, ensure_ascii=False, indent=2), encoding="utf-8")
        raise SystemExit(f"Test startup failed: {error}")
