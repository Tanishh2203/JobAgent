// Cron endpoint: for every user with a digest_email, draft emails for
// un-drafted matches (>= min_score, within experience/work-mode filters)
// up to top_k. Returns a per-user summary. Called by pg_cron via pg_net
// with apikey header (the /api/public/ prefix bypasses edge auth).
//
// Actual outbound email delivery is not wired in v1 — drafts are persisted
// to the drafts table and shown in the dashboard. To send them, wire in a
// free-tier email API (e.g. Resend's free tier, or Gmail SMTP with an app
// password) and have this handler iterate `drafts` to send a digest.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { draftEmail } from "@/lib/email-writer.server";

export const Route = createFileRoute("/api/public/run-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("Server misconfigured", { status: 500 });

        const provided = request.headers.get("x-cron-secret") ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(secret);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles").select("user_id, min_score, top_k, work_modes, my_experience_years, digest_email");
        if (error) return new Response(error.message, { status: 500 });

        const results: Record<string, unknown>[] = [];
        for (const p of profiles ?? []) {
          if (!p.digest_email) { results.push({ user_id: p.user_id, skipped: "no digest_email" }); continue; }

          const { data: resume } = await supabaseAdmin
            .from("resumes").select("text").eq("user_id", p.user_id).eq("is_active", true)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (!resume) { results.push({ user_id: p.user_id, skipped: "no resume" }); continue; }

          // Jobs to draft: >= min_score, work_mode in allowed set, no existing draft.
          const { data: candidates } = await supabaseAdmin
            .from("jobs")
            .select("id, title, company, description, experience_min, experience_max, work_mode, score, drafts:drafts(id)")
            .eq("user_id", p.user_id)
            .gte("score", p.min_score)
            .in("work_mode", p.work_modes)
            .order("score", { ascending: false })
            .limit(p.top_k);

          const todo = (candidates ?? []).filter((j: { drafts?: { id: string }[] }) =>
            !j.drafts || j.drafts.length === 0
          );

          let drafted = 0;
          for (const job of todo) {
            // Experience gate
            if (job.experience_min != null && job.experience_min > p.my_experience_years + 2) continue;
            const expReq = job.experience_min != null
              ? `${job.experience_min}${job.experience_max != null ? "-" + job.experience_max : "+"} years`
              : "";
            try {
              const d = await draftEmail({
                resumeText: resume.text,
                jobTitle: job.title,
                company: job.company,
                jd: job.description,
                experienceReq: expReq,
              });
              await supabaseAdmin.from("drafts").upsert({
                user_id: p.user_id, job_id: job.id, subject: d.subject, body: d.body, model: d.model,
              }, { onConflict: "user_id,job_id" });
              drafted += 1;
            } catch (e) {
              console.error(`[digest] draft failed for job ${job.id}:`, (e as Error).message);
            }
          }
          results.push({ user_id: p.user_id, candidates: candidates?.length ?? 0, drafted });
        }
        return Response.json({ ok: true, results });
      },
    },
  },
});
