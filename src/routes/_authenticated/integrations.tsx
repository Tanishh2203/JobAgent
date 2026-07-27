import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIngestInfo } from "@/lib/api.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [
    { title: "Integrations · Job Agent" },
    { name: "description", content: "Wire your Python scraper to the ingest webhook." },
    { property: "og:title", content: "Job Agent Integrations" },
    { property: "og:description", content: "Connect your Python scraper via HMAC-signed webhook." },
  ]}),
  component: Integrations,
});

function Integrations() {
  const infoFn = useServerFn(getIngestInfo);
  const info = useQuery({ queryKey: ["ingest-info"], queryFn: () => infoFn() });

  const url = typeof window !== "undefined" ? `${window.location.origin}/api/public/ingest-jobs` : "";
  const userId = info.data?.userId ?? "…";

  const pySnippet = `# Add to your scraper.py — POST jobs to the web app
import os, json, hmac, hashlib, requests
from datetime import datetime, timezone

WEBHOOK_URL = "${url}"
USER_ID     = "${userId}"
INGEST_SECRET = os.environ["INGEST_SECRET"]   # ask the app admin for this value

def post_jobs(jobs: list[dict]) -> None:
    """jobs: list of {source_id, source, title, company, location,
    description, url, posted_at (ISO), is_remote, experience_text}"""
    body = json.dumps({"userId": USER_ID, "jobs": jobs}, separators=(",", ":"))
    sig = hmac.new(INGEST_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    r = requests.post(WEBHOOK_URL, data=body,
                      headers={"content-type": "application/json",
                               "x-ingest-signature": sig},
                      timeout=30)
    r.raise_for_status()
    print("ingest:", r.json())

# Example: adapting JobSpy rows
# from jobspy import scrape_jobs
# df = scrape_jobs(site_name=["linkedin","naukri"], search_term="AI ML Engineer",
#                  location="Bangalore, India", hours_old=24)
# rows = [{
#     "source_id": str(r["id"]),
#     "source": r["site"],
#     "title": r["title"], "company": r["company"],
#     "location": r.get("location"), "description": r.get("description",""),
#     "url": r.get("job_url"), "posted_at": r["date_posted"].isoformat() if r.get("date_posted") else None,
#     "is_remote": bool(r.get("is_remote")),
#     "experience_text": r.get("experience_range") or "",
# } for _, r in df.iterrows()]
# post_jobs(rows)
`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">Wire your existing Python scraper into this app via a signed webhook.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Ingest webhook</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="URL" value={url} />
          <Row label="Your user ID" value={userId} />
          <Row label="Signature header" value="x-ingest-signature (HMAC-SHA256 hex, over raw body, using INGEST_SECRET)" />
          <Row label="Secret" value="INGEST_SECRET — stored server-side. Copy the same value from your web app's .env into your scraper's .env." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Python snippet</CardTitle>
          <Badge variant="outline">Drop into your scraper.py</Badge>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[500px] overflow-auto rounded-md bg-muted p-4 text-xs">{pySnippet}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Digest cron</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>A background job at <code className="rounded bg-muted px-1">/api/public/run-digest</code> drafts emails for un-drafted matches (≥ your min score, within work-mode & experience filters, up to top-K).</p>
          <p>Trigger it manually from a shell:</p>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">curl -X POST {url.replace("/ingest-jobs", "/run-digest")}</pre>
          <p>Or schedule it with pg_cron directly in your Supabase project (SQL Editor → <code className="rounded bg-muted px-1">cron.schedule(...)</code>), or an EventBridge Scheduler rule if hosting on AWS.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-all font-mono text-sm">{value}</p>
    </div>
  );
}
