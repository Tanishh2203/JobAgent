// Shared job-ingest logic used by the public webhook and the manual "run digest" endpoint.
import { scoreJob, parseExperience, detectWorkMode } from "./matching.server";

export interface IncomingJob {
  source_id: string;
  source?: string;
  title: string;
  company: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  posted_at?: string | null; // ISO
  is_remote?: boolean | null;
  experience_text?: string | null;
}

export interface ProcessedJob {
  user_id: string;
  source_id: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  work_mode: string;
  experience_min: number | null;
  experience_max: number | null;
  description: string;
  url: string | null;
  posted_at: string | null;
  score: number;
  matched_skills: string[];
}

export function processJob(
  userId: string,
  resumeText: string,
  resumeSkills: string[],
  job: IncomingJob,
): ProcessedJob {
  const jd = job.description ?? "";
  const { score, matched } = scoreJob(resumeText, resumeSkills, `${job.title}\n${jd}`);
  const exp = parseExperience(job.experience_text ?? jd);
  const workMode = detectWorkMode(`${jd} ${job.location ?? ""}`, job.is_remote ?? null);
  return {
    user_id: userId,
    source_id: job.source_id,
    source: job.source ?? "unknown",
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    work_mode: workMode,
    experience_min: exp.min,
    experience_max: exp.max,
    description: jd,
    url: job.url ?? null,
    posted_at: job.posted_at ?? null,
    score,
    matched_skills: matched,
  };
}
