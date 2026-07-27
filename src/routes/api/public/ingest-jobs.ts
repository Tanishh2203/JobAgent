// Public webhook: your Python scraper POSTs jobs here.
// Body: { userId: string, jobs: IncomingJob[] }
// Auth: HMAC-SHA256 over the raw body using INGEST_SECRET, sent as `x-ingest-signature`.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { processJob } from "@/lib/ingest.server";

const IncomingJobSchema = z.object({
  source_id: z.string().min(1),
  source: z.string().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  is_remote: z.boolean().nullable().optional(),
  experience_text: z.string().nullable().optional(),
});

const BodySchema = z.object({
  userId: z.string().uuid(),
  jobs: z.array(IncomingJobSchema).min(1).max(200),
});

export const Route = createFileRoute("/api/public/ingest-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INGEST_SECRET;
        if (!secret) return new Response("Server misconfigured", { status: 500 });

        const sigHeader = request.headers.get("x-ingest-signature") ?? "";
        const raw = await request.text();
        const expected = createHmac("sha256", secret).update(raw).digest("hex");

        const a = Buffer.from(sigHeader);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed;
        try {
          parsed = BodySchema.parse(JSON.parse(raw));
        } catch (e) {
          return new Response(`Invalid body: ${(e as Error).message}`, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: resume, error: re } = await supabaseAdmin
          .from("resumes").select("text, skills")
          .eq("user_id", parsed.userId).eq("is_active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (re) return new Response(re.message, { status: 500 });
        if (!resume) return new Response("No active resume for user", { status: 409 });

        const rows = parsed.jobs.map((j) =>
          processJob(parsed.userId, resume.text, resume.skills as string[], j),
        );

        const { error, count } = await supabaseAdmin
          .from("jobs")
          .upsert(rows, { onConflict: "user_id,source_id", ignoreDuplicates: true, count: "exact" });
        if (error) return new Response(error.message, { status: 500 });

        return Response.json({ ok: true, received: rows.length, inserted: count ?? null });
      },
    },
  },
});
