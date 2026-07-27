# Deploying to AWS

The project has three pieces. You decide independently where each one runs:

| Piece | What it is | Recommended AWS home |
|---|---|---|
| Web app | TanStack Start (React SSR + server functions) | **App Runner** or **ECS Fargate** |
| Database + Auth | Supabase (managed Postgres + auth + RLS) | **Keep Supabase** (they run on AWS anyway) |
| Scraper | Python + JobSpy, one-shot process | **EC2 + systemd timer** or **ECS Scheduled Task** |

The web app can also stay on Lovable Cloud while you move only the scraper — everything talks over the signed webhook, no coupling.

---

## 1. Database — keep Supabase

Do not migrate off Supabase unless you have a real reason. You get Postgres + auth + RLS + storage for free on their hosted tier, and the whole app is wired to it (see `src/integrations/supabase/*` and the RLS policies in `supabase/migrations/`).

You already have a project. If you want your own:

1. Create a new project at supabase.com (choose an AWS region close to your users).
2. Run the migrations: `supabase link --project-ref <ref> && supabase db push` (Supabase CLI), or paste `supabase/migrations/*.sql` into the SQL editor in order.
3. Copy the new project URL + publishable (anon) key + service role key into your `.env`.

The publishable key is safe to expose (RLS is the security layer). The **service role key is not** — it must only live server-side, in App Runner / ECS env vars, never in the client bundle and never in git.

---

## 2. Web app — App Runner (easiest) or ECS Fargate (more control)

Both use the same `Dockerfile` at the repo root. That Dockerfile builds with the AWS-flavored Vite config (`vite.config.aws.ts`), which switches Nitro's target from Cloudflare Workers (Lovable's default) to a standalone Node server.

### Option A: App Runner (recommended)

Fastest path. Auto-scales, HTTPS included, no load balancer to set up.

```bash
# Build and push to ECR (one-time ECR repo creation not shown)
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <acct>.dkr.ecr.ap-south-1.amazonaws.com
docker build -t job-agent-web .
docker tag job-agent-web:latest <acct>.dkr.ecr.ap-south-1.amazonaws.com/job-agent-web:latest
docker push <acct>.dkr.ecr.ap-south-1.amazonaws.com/job-agent-web:latest
```

Then in the AWS console: **App Runner → Create service → Container registry → ECR** → point at the image, port `3000`, and set env vars:

Required env vars on App Runner:

```
SUPABASE_URL              (server + build-time)
SUPABASE_PUBLISHABLE_KEY  (server + build-time)
VITE_SUPABASE_URL         (build-time, same value)
VITE_SUPABASE_PUBLISHABLE_KEY (build-time, same value)
SUPABASE_SERVICE_ROLE_KEY (server-only, from Secrets Manager)
INGEST_SECRET             (server-only, from Secrets Manager)
GEMINI_API_KEY            (server-only, from Secrets Manager) — free tier key from aistudio.google.com
CRON_SECRET               (server-only, from Secrets Manager)
```

The `VITE_*` values are baked into the client bundle **at build time** — you must set them before the docker build if you rebuild the image inside App Runner. If you build locally and push to ECR (as above), pass them as `--build-arg` (add matching `ARG`/`ENV` lines to the Dockerfile) or use App Runner's build config. Simplest: bake them into the image, since publishable keys are safe to include.

### Option B: ECS Fargate

Use ECS when you outgrow App Runner (VPC access to RDS, private networking, custom scaling policies, sidecars). Task definition CPU `256` / memory `512` is fine to start. Put the service behind an ALB with an ACM cert.

### Option C: Elastic Beanstalk (Node platform)

Only pick this if your team already has an EB pipeline. It works but the container path is cleaner and doesn't lock you to EB conventions.

### Option D: AWS Lambda

Set `NITRO_PRESET=aws-lambda` in the Dockerfile (or when running `vite build`) and the build produces a Lambda-compatible handler. Wire it behind API Gateway or a Lambda Function URL. Cold starts on an SSR React app aren't fun — pick this only if traffic is genuinely spiky and low.

---

## 3. Scraper — see `scraper/README.md`

Two paths depending on whether you want to manage a VM:

- **EC2 + systemd timer** — you already run Rasoi on EC2, this is the same shape. Cost: whatever the smallest instance you're comfortable with runs at. `t4g.nano` is enough.
- **ECS Scheduled Task** — no VM to babysit. EventBridge Scheduler fires an ECS `RunTask` on your cadence. Fargate spot pricing is a few cents per run.

Details, both paths, are in `scraper/README.md`.

---

## 4. Secrets checklist

Never commit these. Put them in **AWS Secrets Manager** and reference them from App Runner / ECS task definitions:

- `SUPABASE_SERVICE_ROLE_KEY`
- `INGEST_SECRET` — must match on both web app and scraper, exactly
- `LOVABLE_API_KEY` (or your replacement provider key — see below)
- `CRON_SECRET`

The `.env.example` files at repo root and in `scraper/` show every variable you'll need.

---

## 5. Lovable dependency status

Already removed, verified with a real `vite build`:

- **Sign-in**: was Lovable Cloud Auth (`@lovable.dev/cloud-auth-js`) for Google/Apple/Microsoft OAuth — a service that only functions when the app runs on Lovable's own infrastructure. Removed entirely. Sign-in is email + password via Supabase Auth only.
- **AI drafting**: was Lovable's AI Gateway (`ai.gateway.lovable.dev`, required `LOVABLE_API_KEY`). Replaced with `@ai-sdk/google` calling Gemini directly with your own free `GEMINI_API_KEY`. No Lovable account or billing relationship involved.

**One dependency intentionally kept:** `@lovable.dev/vite-tanstack-config` in `devDependencies`. This is a build-time-only Vite plugin bundle (wires up the TanStack Start + Tailwind v4 + Nitro plugins with tested-good defaults) — it does not create an account, does not phone out to any Lovable service at runtime, and does not cost anything to install or use. It's functionally equivalent to any other npm dev-dependency. Ejecting it means hand-writing the TanStack Start + Tailwind v4 + Nitro Vite config from scratch, which is real work for zero cost or independence benefit since it's already free and inert. If you still want it gone, say so and it can be done, but it's not required to hit either of your stated goals (no Lovable account/service dependency, no cost).

---

## 6. Cron for `/api/public/run-digest`

The digest endpoint needs to be called on a schedule. Options:

- **EventBridge Scheduler → HTTPS target** (simplest): create a schedule that POSTs to `https://your-app/api/public/run-digest` with header `x-cron-secret: <CRON_SECRET>`. The endpoint rejects requests without a matching header.
- **pg_cron in Supabase**: `SELECT cron.schedule('digest', '0 */3 * * *', $$SELECT net.http_post(url:='https://your-app/api/public/run-digest', headers:='{"x-cron-secret": "<CRON_SECRET>"}'::jsonb)$$);` — Supabase-native, no AWS piece needed.
- **A second systemd timer on the same EC2** running the scraper — cheapest, ugliest.

Pick one, don't run more than one at a time or you'll get duplicate draft attempts.
