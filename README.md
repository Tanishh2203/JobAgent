# Job Agent — full stack (web + scraper)

Two independent programs that talk over one HTTPS webhook:

```
┌─────────────────────────┐  HMAC-signed POST   ┌──────────────────────────┐
│  Python scraper         │ ──────────────────▶ │  Web app                 │
│  (JobSpy, this repo:    │  /api/public/       │  (TanStack Start,        │
│   scraper/)             │  ingest-jobs        │   this repo root)        │
│                         │                     │                          │
│  Runs on EC2 or ECS,    │                     │  Runs on App Runner /    │
│  scheduled every ~2.5h  │                     │  ECS / EB / Lambda       │
└─────────────────────────┘                     └───────────┬──────────────┘
                                                            │
                                                            ▼
                                                ┌──────────────────────────┐
                                                │  Supabase                │
                                                │  (Postgres + auth + RLS) │
                                                └──────────────────────────┘
```

The two sides are decoupled on purpose. You can move, restart, or replace either half without touching the other — they only agree on the webhook contract (JSON body + `x-ingest-signature` header).

## Why this split (and not one Python monolith)

- Python is best-in-class for scraping. JobSpy is Python.
- React is best-in-class for the UI. TanStack Start gives you SSR + typed server functions in one repo.
- Trying to force both into one language means giving up strength on one side. Streamlit UIs top out fast; scraping from Node means fighting selectors that the Python community already solved.

If you're not sold, that's a real design decision to push back on — but rewriting either half into the other's language costs real hours for a worse result on both ends.

## What's in this repo

```
.
├── README.md              ← you are here
├── DEPLOY_AWS.md          ← full AWS deployment guide
├── .env.example           ← web-app env template (copy to .env)
├── .gitignore             ← blocks .env from ever being committed
├── Dockerfile             ← web-app container (Node runtime)
├── vite.config.ts         ← Lovable default (Cloudflare target)
├── vite.config.aws.ts     ← AWS override (Node target — used by Dockerfile)
├── src/                   ← React + TanStack Start app
├── supabase/migrations/   ← DB schema + RLS policies
└── scraper/               ← Python + JobSpy
    ├── scraper.py
    ├── requirements.txt
    ├── .env.example
    ├── Dockerfile
    ├── README.md
    └── deploy/systemd/    ← systemd unit + timer for EC2
```

## Zero-cost account setup

Two free accounts, no credit card required for either at the tiers this app needs:

1. **Supabase** — [supabase.com/dashboard](https://supabase.com/dashboard/sign-up) → New Project. Free tier: 500MB DB, 50k monthly active users, more than enough here. Copy the Project URL and anon/publishable key from Project Settings → API into `.env`. Run the SQL in `supabase/migrations/*.sql` (in order) via the SQL Editor, or `supabase db push` with the CLI.
2. **Google Gemini** — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → Create API key. Free tier covers the email-drafting feature at normal personal-use volume; check current limits at [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) since Google adjusts these.

That's it — no Lovable account anywhere in this stack. The original zip used Lovable Cloud Auth for Google/Apple/Microsoft sign-in (a Lovable-hosted service that only works when the app is running on Lovable's own infrastructure — that's the 404 you hit on `/~oauth/initiate` when running locally) and Lovable's AI Gateway for drafting. Both are removed:

- Sign-in is now email + password only, handled directly by Supabase Auth. No Google button.
- Drafting calls Google's Gemini API directly with your own key, not through Lovable's gateway.

## Quick start (local dev)

**1. Web app**

```bash
cp .env.example .env       # fill in Supabase URL + publishable key + GEMINI_API_KEY
npm install
npm run dev                # http://localhost:3000
```

Sign up in the app (email + password), upload your resume in `/settings`, then open `/integrations` to see your `USER_ID` and the exact webhook URL.

**2. Scraper**

```bash
cd scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Paste WEBHOOK_URL, USER_ID, INGEST_SECRET from the web app
$EDITOR .env
python scraper.py
```

Jobs should appear in the web app's `/jobs` page within a few seconds.

## Deploying

See **`DEPLOY_AWS.md`** for the full guide. Short version:

- Web app → **AWS App Runner** (build `Dockerfile`, push to ECR, point App Runner at it, set env vars).
- Database → **keep Supabase** (Supabase runs on AWS anyway; migrating to bare RDS loses auth + RLS for no gain).
- Scraper → **EC2 + the provided systemd timer** (2.5h cadence), or **ECS Scheduled Task** if you don't want to manage a VM.

## Secrets discipline

The `.env` at repo root was in the original zip. It's been replaced with `.env.example`. The `.gitignore` now blocks any real `.env` from being committed. Never remove those `!.env.example` lines from `.gitignore` and don't add `.env` back to git tracking — publishable keys are OK to expose, but `SUPABASE_SERVICE_ROLE_KEY` and `INGEST_SECRET` are not, and mixing them in the same file is asking for a mistake.

If the old `INGEST_SECRET` ever went public, rotate it: generate a new one with `openssl rand -hex 32`, set it in the web app's env, and paste the identical value into the scraper's `.env`.
