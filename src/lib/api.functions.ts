// createServerFn RPCs for the browser UI.
// All *.functions.ts modules are thin wrappers — helpers live in .server.ts files.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractPdfText } from "./resume-parse.server";
import { extractSkills } from "./skill-extract.server";
import { draftEmail } from "./email-writer.server";
import { triggerScrapeForUser } from "./scrape-trigger.server";

// ---------- profile ----------
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const ProfilePatch = z.object({
  my_experience_years: z.number().min(0).max(50).optional(),
  search_term: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  min_score: z.number().min(0).max(1).optional(),
  top_k: z.number().int().min(1).max(100).optional(),
  work_modes: z.array(z.string()).optional(),
  hours_old: z.number().int().min(1).max(720).optional(),
  digest_email: z.string().email().nullable().optional(),
  full_name: z.string().max(200).nullable().optional(),
  linkedin: z.string().max(400).nullable().optional(),
  github: z.string().max(400).nullable().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfilePatch.parse(d))
  .handler(async ({ data, context }) => {
    const patch = { user_id: context.userId, ...data, updated_at: new Date().toISOString() };
    const { data: row, error } = await context.supabase
      .from("profiles").upsert(patch, { onConflict: "user_id" }).select().single();
    if (error) throw new Error(error.message);

    // Best-effort: kick off an immediate re-scrape for this user so the new
    // search term/location/resume takes effect now instead of waiting for
    // the next scheduled run. Never fails the save if this doesn't work.
    const scrapeTrigger = await triggerScrapeForUser(context.userId);

    return { ...row, scrapeTrigger };
  });

// ---------- resume ----------
export const getActiveResume = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("resumes").select("id, filename, text, skills, created_at")
      .eq("user_id", context.userId).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const UploadInput = z.object({
  filename: z.string().min(1).max(255),
  base64: z.string().min(10), // base64 of the PDF bytes
});

export const uploadResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data, context }) => {
    // Decode base64 → Uint8Array
    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const text = await extractPdfText(bytes);
    if (!text.trim()) throw new Error("Could not extract text from PDF");
    const skills = await extractSkills(text);

    // Deactivate previous resumes
    await context.supabase.from("resumes")
      .update({ is_active: false }).eq("user_id", context.userId);

    const { data: row, error } = await context.supabase.from("resumes").insert({
      user_id: context.userId,
      filename: data.filename,
      text,
      skills,
      is_active: true,
    }).select().single();
    if (error) throw new Error(error.message);
    return { id: row.id, filename: row.filename, skills: row.skills, chars: text.length };
  });

const SkillsPatch = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).max(200),
});

// Lets the user hand-add or remove skills on top of what extraction found.
// Client sends the full desired list; the next resume upload re-runs
// extraction and replaces it (extraction always keeps running on upload).
export const updateResumeSkills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SkillsPatch.parse(d))
  .handler(async ({ data, context }) => {
    const normalized = Array.from(
      new Set(data.skills.map((s) => s.trim().toLowerCase()).filter(Boolean))
    ).sort();

    const { data: row, error } = await context.supabase
      .from("resumes")
      .update({ skills: normalized })
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .select("id, skills")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- jobs ----------
export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("jobs")
      .select("id, source, source_id, title, company, location, work_mode, experience_min, experience_max, url, posted_at, score, matched_skills, ingested_at")
      .eq("user_id", context.userId)
      .order("score", { ascending: false })
      .order("ingested_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const clearJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error, count } = await context.supabase
      .from("jobs").delete({ count: "exact" }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

const JobIdInput = z.object({ id: z.string().uuid() });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("jobs").select("*").eq("id", data.id).eq("user_id", context.userId).single();
    if (error) throw new Error(error.message);
    const { data: draft } = await context.supabase
      .from("drafts").select("*").eq("job_id", data.id).eq("user_id", context.userId).maybeSingle();
    return { job, draft };
  });

export const generateDraftForJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: job, error: je }, { data: resume, error: re }] = await Promise.all([
      context.supabase.from("jobs").select("*").eq("id", data.id).eq("user_id", context.userId).single(),
      context.supabase.from("resumes").select("text").eq("user_id", context.userId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (je) throw new Error(je.message);
    if (re) throw new Error(re.message);
    if (!resume?.text) throw new Error("Upload a resume first");

    const expReq = job.experience_min != null
      ? `${job.experience_min}${job.experience_max != null ? "-" + job.experience_max : "+"} years`
      : "";

    const draft = await draftEmail({
      resumeText: resume.text,
      jobTitle: job.title,
      company: job.company,
      jd: job.description,
      experienceReq: expReq,
    });

    const { data: row, error } = await context.supabase.from("drafts").upsert({
      user_id: context.userId,
      job_id: job.id,
      subject: draft.subject,
      body: draft.body,
      model: draft.model,
    }, { onConflict: "user_id,job_id" }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- drafts ----------
export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drafts")
      .select("id, subject, body, model, created_at, job_id, jobs(title, company, url)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- integrations info ----------
export const getIngestInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const base = process.env.PUBLIC_URL || "";
    return {
      userId: context.userId,
      webhookPath: "/api/public/ingest-jobs",
      baseUrl: base,
      note: "The INGEST_SECRET is stored server-side. Ask the admin (you) for the value to paste into your Python scraper's .env.",
    };
  });
