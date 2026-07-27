import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJobs, listDrafts, getProfile, getActiveResume } from "@/lib/api.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, Mail, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard · Job Agent" },
    { name: "description", content: "Your latest matched jobs and generated cold-email drafts." },
    { property: "og:title", content: "Job Agent Dashboard" },
    { property: "og:description", content: "Track matched jobs and AI-drafted outreach." },
  ]}),
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const jobsFn = useServerFn(listJobs);
  const draftsFn = useServerFn(listDrafts);
  const profileFn = useServerFn(getProfile);
  const resumeFn = useServerFn(getActiveResume);

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => jobsFn() });
  const drafts = useQuery({ queryKey: ["drafts"], queryFn: () => draftsFn() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const resume = useQuery({ queryKey: ["resume"], queryFn: () => resumeFn() });

  const matched = (jobs.data ?? []).filter((j) => Number(j.score) >= Number(profile.data?.min_score ?? 0.35));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back{profile.data?.full_name ? `, ${profile.data.full_name}` : ""}.</p>
      </div>

      {!resume.isLoading && !resume.data && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium">Upload your resume to start matching</p>
              <p className="text-sm text-muted-foreground">The app needs your resume text to score jobs and draft emails.</p>
            </div>
            <Button onClick={() => router.navigate({ to: "/settings" })}>Go to Settings</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total jobs" value={jobs.data?.length ?? 0} icon={<Briefcase className="h-4 w-4" />} />
        <Stat label="Matches ≥ min" value={matched.length} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Drafts" value={drafts.data?.length ?? 0} icon={<Mail className="h-4 w-4" />} />
        <Stat label="Resume skills" value={resume.data?.skills?.length ?? 0} icon={<FileText className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Recent drafts</CardTitle></CardHeader>
        <CardContent>
          {drafts.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : (drafts.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No drafts yet. Open a matched job in the Jobs tab and generate one, or trigger the digest.</p>
          : <ul className="divide-y">
              {(drafts.data ?? []).slice(0, 6).map((d) => {
                const j = d.jobs as { title: string; company: string } | null;
                return (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{j?.title ?? "—"} <span className="text-muted-foreground">@ {j?.company ?? "—"}</span></p>
                      <p className="truncate text-xs text-muted-foreground">{d.subject}</p>
                    </div>
                    <Badge variant="outline">{new Date(d.created_at).toLocaleDateString()}</Badge>
                  </li>
                );
              })}
            </ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Top matches</CardTitle>
          <Link to="/jobs" className="text-sm text-primary hover:underline">View all →</Link>
        </CardHeader>
        <CardContent>
          {matched.slice(0, 5).length === 0 ? <p className="text-sm text-muted-foreground">No matches yet. Wire up your scraper on the Integrations tab.</p>
          : <ul className="divide-y">
              {matched.slice(0, 5).map((j) => (
                <li key={j.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="truncate text-sm font-medium hover:underline">
                      {j.title} <span className="text-muted-foreground">@ {j.company}</span>
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{j.location ?? "—"} · {j.work_mode}</p>
                  </div>
                  <Badge>{Math.round(Number(j.score) * 100)}</Badge>
                </li>
              ))}
            </ul>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
