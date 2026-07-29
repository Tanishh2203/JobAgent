import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getProfile, updateProfile, uploadResume, getActiveResume, updateResumeSkills } from "@/lib/api.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Settings · Job Agent" },
    { name: "description", content: "Upload your resume and configure search filters." },
    { property: "og:title", content: "Job Agent Settings" },
    { property: "og:description", content: "Configure resume, filters, and digest email." },
  ]}),
  component: SettingsPage,
});

const WORK_MODES = ["Remote", "Hybrid", "On-site", "Not specified"];

function SettingsPage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const updateFn = useServerFn(updateProfile);
  const uploadFn = useServerFn(uploadResume);
  const resumeFn = useServerFn(getActiveResume);
  const skillsFn = useServerFn(updateResumeSkills);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const resumeQ = useQuery({ queryKey: ["resume"], queryFn: () => resumeFn() });

  const [form, setForm] = useState<Record<string, unknown>>({});
  useEffect(() => { if (profileQ.data) setForm(profileQ.data); }, [profileQ.data]);

  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  useEffect(() => { setSkills(resumeQ.data?.skills ?? []); }, [resumeQ.data?.id]);

  const skillsMutation = useMutation<{ skills: string[] }, Error, string[], string[]>({
    mutationFn: (next) => skillsFn({ data: { skills: next } }),
    onMutate: (next) => { const prev = skills; setSkills(next); return prev; },
    onError: (e, _next, prevSkills) => { toast.error(e.message); if (prevSkills) setSkills(prevSkills); },
  });

  const addSkill = () => {
    const s = newSkill.trim().toLowerCase();
    setNewSkill("");
    if (!s || skills.includes(s)) return;
    skillsMutation.mutate([...skills, s].sort());
  };

  const removeSkill = (s: string) => {
    skillsMutation.mutate(skills.filter((x) => x !== s));
  };

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateFn({ data: patch }),
    onSuccess: (row) => {
      if (row.scrapeTrigger?.triggered) {
        toast.success("Saved — searching for new jobs now (usually takes 1-2 min)");
      } else {
        toast.success("Saved");
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const base64 = btoa(bin);
      return uploadFn({ data: { filename: file.name, base64 } });
    },
    onSuccess: (r) => { toast.success(`Parsed ${r.chars} chars, ${r.skills.length} skills`); qc.invalidateQueries({ queryKey: ["resume"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const val = <K extends string>(k: K): string => (form[k] as string) ?? "";
  const num = <K extends string>(k: K): number => (form[k] as number) ?? 0;
  const arr = <K extends string>(k: K): string[] => (form[k] as string[]) ?? [];

  if (profileQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Resume</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {resumeQ.data ? (
            <div>
              <p className="text-sm"><span className="font-medium">{resumeQ.data.filename}</span> · uploaded {new Date(resumeQ.data.created_at).toLocaleDateString()}</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">No resume uploaded yet.</p>}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" />
            <span>{upload.isPending ? "Parsing…" : "Upload PDF"}</span>
            <input type="file" accept="application/pdf" className="hidden" disabled={upload.isPending}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          </label>

          {resumeQ.data && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Skills (auto-extracted from your resume — add or remove as needed)
              </Label>
              <div className="flex flex-wrap gap-1">
                {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills yet.</p>}
                {skills.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 pr-1">
                    {s}
                    <button
                      type="button"
                      aria-label={`Remove ${s}`}
                      className="rounded-sm hover:bg-muted-foreground/20"
                      onClick={() => removeSkill(s)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Add a skill (e.g. react native)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                  className="max-w-xs"
                />
                <Button type="button" variant="outline" onClick={addSkill} disabled={!newSkill.trim()}>
                  Add
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Personal info (for email signature)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Full name"><Input value={val("full_name")} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Digest email"><Input type="email" value={val("digest_email")} onChange={(e) => setForm({ ...form, digest_email: e.target.value })} /></Field>
          <Field label="LinkedIn URL"><Input value={val("linkedin")} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} /></Field>
          <Field label="GitHub URL"><Input value={val("github")} onChange={(e) => setForm({ ...form, github: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Search & match filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Search term"><Input value={val("search_term")} onChange={(e) => setForm({ ...form, search_term: e.target.value })} /></Field>
          <Field label="Location"><Input value={val("location")} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="My experience (years)"><Input type="number" step="0.5" value={num("my_experience_years")} onChange={(e) => setForm({ ...form, my_experience_years: Number(e.target.value) })} /></Field>
          <Field label="Posted within (hours)"><Input type="number" value={num("hours_old")} onChange={(e) => setForm({ ...form, hours_old: Number(e.target.value) })} /></Field>
          <Field label={`Min match score (${Math.round(num("min_score") * 100)})`}>
            <Input type="range" min={0} max={1} step={0.05} value={num("min_score")} onChange={(e) => setForm({ ...form, min_score: Number(e.target.value) })} />
          </Field>
          <Field label="Top K per digest"><Input type="number" min={1} max={100} value={num("top_k")} onChange={(e) => setForm({ ...form, top_k: Number(e.target.value) })} /></Field>
          <Field label="Allowed work modes" full>
            <div className="flex flex-wrap gap-3">
              {WORK_MODES.map((m) => {
                const checked = arr("work_modes").includes(m);
                return (
                  <label key={m} className="inline-flex items-center gap-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={(v) => {
                      const next = new Set(arr("work_modes"));
                      if (v) next.add(m); else next.delete(m);
                      setForm({ ...form, work_modes: Array.from(next) });
                    }} />
                    {m}
                  </label>
                );
              })}
            </div>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate({
          full_name: form.full_name ?? null,
          digest_email: form.digest_email ?? null,
          linkedin: form.linkedin ?? null,
          github: form.github ?? null,
          search_term: form.search_term as string,
          location: form.location as string,
          my_experience_years: Number(form.my_experience_years ?? 0),
          hours_old: Number(form.hours_old ?? 24),
          min_score: Number(form.min_score ?? 0.35),
          top_k: Number(form.top_k ?? 10),
          work_modes: (form.work_modes as string[]) ?? [],
        })} disabled={save.isPending}>
          <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
