import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getJob, generateDraftForJob } from "@/lib/api.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: () => ({ meta: [
    { title: "Job · Job Agent" },
    { name: "description", content: "Job description with AI-drafted cold email." },
  ]}),
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getJob);
  const genFn = useServerFn(generateDraftForJob);
  const q = useQuery({ queryKey: ["job", jobId], queryFn: () => getFn({ data: { id: jobId } }) });

  const gen = useMutation({
    mutationFn: () => genFn({ data: { id: jobId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job", jobId] }); qc.invalidateQueries({ queryKey: ["drafts"] }); toast.success("Draft generated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">Failed to load.</p>;

  const { job, draft } = q.data;

  return (
    <div className="space-y-6">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <p className="text-muted-foreground">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{Math.round(Number(job.score) * 100)} match</Badge>
          <Badge variant="outline">{job.work_mode}</Badge>
          {job.experience_min != null && <Badge variant="outline">{job.experience_min}{job.experience_max != null ? `-${job.experience_max}` : "+"} yr</Badge>}
          <Badge variant="outline">{job.source}</Badge>
          {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ExternalLink className="h-3 w-3" /> Original posting</a>}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cold email draft</CardTitle>
          <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
            <Sparkles className="mr-1 h-4 w-4" />
            {gen.isPending ? "Drafting…" : draft ? "Regenerate" : "Generate draft"}
          </Button>
        </CardHeader>
        <CardContent>
          {draft ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
                <p className="text-sm font-medium">{draft.subject}</p>
              </div>
              <Textarea value={draft.body} readOnly rows={22} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Model: {draft.model}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No draft yet. Click Generate.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Matched skills</CardTitle></CardHeader>
        <CardContent>
          {(job.matched_skills ?? []).length === 0
            ? <p className="text-sm text-muted-foreground">None detected.</p>
            : <div className="flex flex-wrap gap-1">{(job.matched_skills as string[]).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Job description</CardTitle></CardHeader>
        <CardContent>
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">{job.description}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
