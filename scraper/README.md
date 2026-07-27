# JobSpy Scraper

Standalone Python process. Scrapes jobs with [JobSpy](https://github.com/speedyapply/JobSpy) and POSTs them to the web app's `/api/public/ingest-jobs` webhook. Runs on EC2, Fargate, or any Linux box with Python 3.10+.

**Multi-tenant**: this script does not hardcode a user, search term, or location. Each run reads every row of the web app's `profiles` table and scrapes/posts once per user, using *that user's* search term / location / posting-age window (set on the web app's Settings page). Onboarding a new person is just: they sign up, fill in Settings, upload a resume — nothing here needs to change, and no one has to open this repo again.

## What it does

1. Reads every row from `profiles` (user_id, search_term, location, hours_old) via the Supabase REST API.
2. For each user: calls `jobspy.scrape_jobs(...)` with that user's search term / location / hours_old (sites/results-count are global tuning knobs in `.env`).
3. Maps each JobSpy row into the webhook schema (dedup key, work-mode, experience text, etc.).
4. HMAC-SHA256 signs the JSON body with `INGEST_SECRET` and POSTs it under that user's `user_id`.
5. The web app dedups on `(user_id, source_id)`, scores each job against that user's resume, stores.
6. Retries on 5xx / network errors with exponential backoff. 4xx errors (bad signature, validation) fail fast. A failure for one user doesn't stop the run for the others.

## Local test run

```bash
cd scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in WEBHOOK_URL, INGEST_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# (same INGEST_SECRET/Supabase values the web app uses)
$EDITOR .env
python scraper.py
```

## Deploy on EC2 (systemd — recommended)

```bash
# On the EC2 box:
git clone <your-repo> ~/job-agent
cd ~/job-agent/scraper
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env && $EDITOR .env       # fill in real values

# One-shot install of the systemd timer (2.5h cadence)
./deploy/install-systemd.sh
```

Then:

```bash
sudo systemctl start job-scraper.service   # run once immediately
journalctl -u job-scraper.service -f       # tail logs
systemctl list-timers job-scraper.timer    # see next scheduled run
```

To change the cadence, edit `deploy/systemd/job-scraper.timer` and re-run the installer, or edit `/etc/systemd/system/job-scraper.timer` directly and `sudo systemctl daemon-reload && sudo systemctl restart job-scraper.timer`.

## Deploy on ECS (Docker — no EC2 box)

```bash
cd scraper
docker build -t job-scraper .

# Test locally first
docker run --rm --env-file .env job-scraper
```

Push to ECR, create an ECS Task Definition with the env vars set from AWS Secrets Manager, and create an **ECS Scheduled Task** (EventBridge Scheduler → ECS RunTask) at `rate(2 hours 30 minutes)` or a cron expression. Task memory: 512 MB is plenty for JobSpy.

## Cron alternative (if you don't want systemd)

```bash
# crontab -e
0 */2 * * *  cd /home/ubuntu/job-agent/scraper && .venv/bin/python scraper.py >> ~/scraper.log 2>&1
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401 Invalid signature` | `INGEST_SECRET` mismatch between scraper and web app. They must be **byte-identical**. Regenerate on one side and paste to the other. |
| `409 No active resume for user` | You haven't uploaded a resume in the web app yet. Do that first — the ingest handler needs your resume to score jobs. |
| `400 Invalid body` | JobSpy returned rows with missing title/company. Look at the log for dropped-row counts. Try a broader `SEARCH_TERM` or bump `RESULTS_WANTED`. |
| Empty scrape | LinkedIn/Indeed rate-limited your IP. JobSpy supports proxies (`proxies=` kwarg) — extend `scrape()` in `scraper.py` if needed. |
| `ImportError: python-jobspy` | Wrong package name — install `python-jobspy`, not `jobspy`, from PyPI. Already correct in `requirements.txt`. |
