"""
JobSpy → Job Agent Web ingest.

Multi-tenant: pulls every row from the `profiles` table (via the Supabase
REST API) and, for each user, scrapes with *their* search_term/location/
hours_old and POSTs the results to the web app's HMAC-signed
`/api/public/ingest-jobs` webhook under *their* user_id.

New users never require a code or env change here — they just fill in
their search term / location on the web app's Settings page, and the next
scheduled run (systemd timer, cron, or ECS Scheduled Task) picks them up.

Config is read from environment variables — see .env.example.
Run once with: `python scraper.py`
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

# --- Required config ---------------------------------------------------------
try:
    WEBHOOK_URL: str = os.environ["WEBHOOK_URL"]
    INGEST_SECRET: str = os.environ["INGEST_SECRET"]
    SUPABASE_URL: str = os.environ["SUPABASE_URL"]
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
except KeyError as missing:
    print(f"FATAL: missing env var {missing}. See .env.example.", file=sys.stderr)
    sys.exit(1)

# --- Scrape config (operational tuning, same for every user) -----------------
RESULTS_WANTED = int(os.getenv("RESULTS_WANTED", "50"))
COUNTRY_INDEED = os.getenv("COUNTRY_INDEED", "india")
SITES = [s.strip() for s in os.getenv("JOBSPY_SITES", "linkedin,indeed,naukri").split(",") if s.strip()]
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))  # webhook accepts up to 200
FETCH_DESCRIPTION = os.getenv("LINKEDIN_FETCH_DESCRIPTION", "true").lower() == "true"

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("scraper")


# --- Helpers -----------------------------------------------------------------
def _isna(v: Any) -> bool:
    """pandas.isna wrapper that never raises on non-pandas values."""
    try:
        import pandas as pd
        return bool(pd.isna(v))
    except Exception:
        return v is None


def to_str(v: Any) -> str | None:
    if v is None or _isna(v):
        return None
    s = str(v).strip()
    return s or None


def to_bool(v: Any) -> bool | None:
    if v is None or _isna(v):
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("true", "yes", "1", "t", "y"):
        return True
    if s in ("false", "no", "0", "f", "n"):
        return False
    return None


def to_iso(v: Any) -> str | None:
    if v is None or _isna(v):
        return None
    if hasattr(v, "isoformat"):
        try:
            return v.isoformat()
        except Exception:
            pass
    return str(v)


def make_source_id(row: dict) -> str:
    """Stable per-source id. Falls back to a hash of identifying fields."""
    site = to_str(row.get("site")) or "unk"
    for key in ("id", "job_id"):
        v = to_str(row.get(key))
        if v:
            return f"{site}::{v}"
    url = to_str(row.get("job_url")) or to_str(row.get("job_url_direct"))
    if url:
        return f"{site}::{hashlib.sha1(url.encode()).hexdigest()[:20]}"
    seed = f"{site}::{row.get('title','')}::{row.get('company','')}::{row.get('location','')}"
    return f"{site}::{hashlib.sha1(seed.encode()).hexdigest()[:20]}"


def row_to_job(row: dict) -> dict:
    """Map a JobSpy row into the webhook schema."""
    return {
        "source_id": make_source_id(row),
        "source": to_str(row.get("site")) or "unknown",
        "title": to_str(row.get("title")) or "",
        "company": to_str(row.get("company")) or "",
        "location": to_str(row.get("location")),
        "description": to_str(row.get("description")) or "",
        "url": to_str(row.get("job_url")) or to_str(row.get("job_url_direct")),
        "posted_at": to_iso(row.get("date_posted")),
        "is_remote": to_bool(row.get("is_remote")),
        "experience_text": (
            to_str(row.get("experience_range"))
            or to_str(row.get("job_level"))
            or ""
        ),
    }


def sign(body: bytes) -> str:
    return hmac.new(INGEST_SECRET.encode(), body, hashlib.sha256).hexdigest()


def fetch_profiles(user_id: str | None = None) -> list[dict]:
    """Rows of public.profiles, via the Supabase REST API (service role).

    With `user_id`, fetches just that one profile (used for the on-demand
    "run this user now" trigger). Without it, fetches every profile (the
    normal scheduled-run behavior).
    """
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    params: dict[str, str] = {"select": "user_id,search_term,location,hours_old"}
    if user_id:
        params["user_id"] = f"eq.{user_id}"
    r = requests.get(url, headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def scrape_for(search_term: str, location: str, hours_old: int) -> list[dict]:
    # Import here so failures give a clear "install jobspy" error rather than crashing at module load.
    from jobspy import scrape_jobs

    log.info(
        "scrape: term=%r loc=%r sites=%s hours_old=%d n=%d",
        search_term, location, SITES, hours_old, RESULTS_WANTED,
    )
    df = scrape_jobs(
        site_name=SITES,
        search_term=search_term,
        location=location,
        results_wanted=RESULTS_WANTED,
        hours_old=hours_old,
        country_indeed=COUNTRY_INDEED,
        linkedin_fetch_description=FETCH_DESCRIPTION,
        verbose=1,
    )
    n = len(df) if df is not None else 0
    log.info("scraped %d raw rows", n)
    if n == 0:
        return []
    return df.to_dict("records")


def post_batch(user_id: str, jobs: list[dict], attempt: int = 1, max_attempts: int = 3) -> dict:
    """POST a batch of jobs for one user. Retries 5xx / network errors with backoff."""
    body = json.dumps({"userId": user_id, "jobs": jobs}, separators=(",", ":")).encode()
    headers = {
        "content-type": "application/json",
        "x-ingest-signature": sign(body),
    }
    try:
        r = requests.post(WEBHOOK_URL, data=body, headers=headers, timeout=60)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 0
        body_text = e.response.text if e.response is not None else str(e)
        # 4xx = client error (bad signature, validation) — don't retry.
        if 400 <= code < 500 or attempt >= max_attempts:
            log.error("POST failed (%s): %s", code, body_text[:500])
            raise
        wait = 2**attempt
        log.warning("POST %s, retrying in %ss (attempt %d/%d)", code, wait, attempt, max_attempts)
        time.sleep(wait)
        return post_batch(user_id, jobs, attempt + 1, max_attempts)
    except requests.RequestException as e:
        if attempt >= max_attempts:
            raise
        wait = 2**attempt
        log.warning("POST error %s, retrying in %ss (attempt %d/%d)", e, wait, attempt, max_attempts)
        time.sleep(wait)
        return post_batch(user_id, jobs, attempt + 1, max_attempts)


def post_all(user_id: str, jobs: list[dict]) -> tuple[int, int]:
    total_received = 0
    total_inserted = 0
    batch_count = (len(jobs) + BATCH_SIZE - 1) // BATCH_SIZE
    for i in range(0, len(jobs), BATCH_SIZE):
        batch = jobs[i : i + BATCH_SIZE]
        idx = i // BATCH_SIZE + 1
        resp = post_batch(user_id, batch)
        received = int(resp.get("received", 0) or 0)
        inserted = int(resp.get("inserted", 0) or 0)
        total_received += received
        total_inserted += inserted
        log.info("  batch %d/%d: received=%d inserted=%d", idx, batch_count, received, inserted)
    return total_received, total_inserted


def run_for_profile(profile: dict) -> None:
    user_id = profile.get("user_id")
    search_term = profile.get("search_term") or "AI ML Engineer"
    location = profile.get("location") or "Bangalore, India"
    hours_old = int(profile.get("hours_old") or 24)

    log.info("user %s: term=%r loc=%r", user_id, search_term, location)
    try:
        rows = scrape_for(search_term, location, hours_old)
    except Exception:
        log.exception("user %s: scrape failed", user_id)
        return

    if not rows:
        log.info("user %s: no jobs, skipping.", user_id)
        return

    jobs = [row_to_job(r) for r in rows]
    valid = [j for j in jobs if j["source_id"] and j["title"] and j["company"]]
    dropped = len(jobs) - len(valid)
    if dropped:
        log.warning("user %s: dropped %d invalid rows", user_id, dropped)
    if not valid:
        log.info("user %s: no valid jobs to POST.", user_id)
        return

    try:
        received, inserted = post_all(user_id, valid)
        log.info("user %s: done, received=%d inserted=%d", user_id, received, inserted)
    except Exception:
        log.exception("user %s: posting failed permanently", user_id)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--user-id",
        default=None,
        help=(
            "Scrape just this one user's profile instead of every profile. "
            "Used for on-demand runs (e.g. triggered right after a user "
            "saves new Settings), not the scheduled all-users run."
        ),
    )
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()

    log.info("run start: %s", datetime.now(timezone.utc).isoformat())
    log.info("webhook: %s", WEBHOOK_URL)
    if args.user_id:
        log.info("mode: single-user on-demand run (user_id=%s)", args.user_id)

    try:
        profiles = fetch_profiles(user_id=args.user_id)
    except Exception:
        log.exception("failed to fetch profiles from Supabase")
        return 2

    log.info("found %d profile(s)", len(profiles))
    if not profiles:
        if args.user_id:
            log.error("no profile found for user_id=%s", args.user_id)
            return 3
        return 0

    for profile in profiles:
        run_for_profile(profile)

    log.info("run done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
