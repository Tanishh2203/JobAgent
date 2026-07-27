import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { listJobs, getProfile, clearJobs } from "@/lib/api.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({ meta: [
    { title: "Jobs · Job Agent" },
    { name: "description", content: "Every job your scraper has ingested, ranked by match score." },
    { property: "og:title", content: "All Jobs · Job Agent" },
    { property: "og:description", content: "Ranked jobs from your Python scraper." },
  ]}),
  component: JobsPage,
});

const WORK_MODES = ["Remote", "Hybrid", "On-site", "Not specified"];

function JobsPage() {
  const qc = useQueryClient();
  const jobsFn = useServerFn(listJobs);
  const profileFn = useServerFn(getProfile);
  const clearFn = useServerFn(clearJobs);
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => jobsFn() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });

  const clear = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: (r) => { toast.success(`Cleared ${r.deleted} job listing${r.deleted === 1 ? "" : "s"}`); qc.invalidateQueries({ queryKey: ["jobs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [q, setQ] = useState("");
  const [wm, setWm] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0);

  const platforms = useMemo(
    () => Array.from(new Set((jobs.data ?? []).map((j) => j.source).filter(Boolean))).sort(),
    [jobs.data],
  );

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (jobs.data ?? []).filter((j) => {
      if (wm !== "all" && j.work_mode !== wm) return false;
      if (platform !== "all" && j.source !== platform) return false;
      if (Number(j.score) < minScore) return false;
      if (s && !`${j.title} ${j.company} ${j.location ?? ""}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [jobs.data, q, wm, platform, minScore]);

  const minFromProfile = Number(profile.data?.min_score ?? 0.35);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {jobs.data?.length ?? 0} total · showing {filtered.length}. Your match threshold is {Math.round(minFromProfile * 100)}.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!jobs.data?.length || clear.isPending}>
              <Trash2 className="mr-1 h-4 w-4" /> {clear.isPending ? "Clearing…" : "Clear job listings"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all job listings?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes all {jobs.data?.length ?? 0} job listing{jobs.data?.length === 1 ? "" : "s"} currently
                ingested for your account. New jobs will repopulate on the next scrape run. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => clear.mutate()}>Clear listings</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_160px_160px_1fr]">
          <Input placeholder="Search title, company, location…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={wm} onValueChange={setWm}>
            <SelectTrigger><SelectValue placeholder="Work mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All work modes</SelectItem>
              {WORK_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Min score {Math.round(minScore * 100)}</span>
            <Slider min={0} max={100} step={5} value={[minScore * 100]} onValueChange={([v]) => setMinScore(v / 100)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {jobs.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          : filtered.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No jobs match these filters.</p>
          : <ul className="divide-y">
              {filtered.map((j) => (
                <li key={j.id} className="grid grid-cols-[1fr_auto] items-center gap-4 p-4 hover:bg-accent/30">
                  <div className="min-w-0">
                    <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="block font-medium hover:underline">
                      {j.title} <span className="font-normal text-muted-foreground">@ {j.company}</span>
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{j.location ?? "—"}</span>
                      <span>·</span>
                      <Badge variant="outline" className="font-normal">{j.work_mode}</Badge>
                      {j.experience_min != null && (
                        <Badge variant="outline" className="font-normal">
                          {j.experience_min}{j.experience_max != null ? `-${j.experience_max}` : "+"} yr
                        </Badge>
                      )}
                      <Badge variant="outline" className="font-normal">{j.source}</Badge>
                      {j.posted_at && (
                        <span title={new Date(j.posted_at).toLocaleString()}>
                          Posted {formatDistanceToNow(new Date(j.posted_at), { addSuffix: true })}
                        </span>
                      )}
                      {j.url && <a href={j.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3 w-3" /> link</a>}
                    </div>
                  </div>
                  <Badge className={Number(j.score) >= minFromProfile ? "" : "opacity-50"}>
                    {Math.round(Number(j.score) * 100)}
                  </Badge>
                </li>
              ))}
            </ul>}
        </CardContent>
      </Card>
    </div>
  );
}
