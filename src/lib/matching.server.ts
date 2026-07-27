// Server-only matching, experience parsing, work-mode detection.
// Mirrors the Python matcher.py + experience.py + workmode.py in TypeScript.
import { extractSkills } from "./skill-vocab";

const STOPWORDS = new Set([
  "the","and","for","with","you","are","our","from","this","that","have","has","was","will",
  "not","but","all","any","can","use","using","your","who","what","how","when","where","why",
  "a","an","of","to","in","on","at","by","is","be","or","as","we","if","it","its","their",
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#.\-]{1,}/g) ?? [])
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Composite score in [0, 1]:
 *   0.6 * jd-term overlap density (jd tokens present in resume / jd token count)
 *   0.4 * skill overlap (matched skills / max(1, resume skills))
 */
export function scoreJob(resumeText: string, resumeSkills: string[], jdText: string) {
  const jdTok = tokens(jdText);
  const resumeTok = new Set(tokens(resumeText));
  if (jdTok.length === 0) return { score: 0, matched: [] as string[] };

  let overlap = 0;
  for (const t of jdTok) if (resumeTok.has(t)) overlap += 1;
  const density = overlap / jdTok.length;

  const jdSkills = new Set(extractSkills(jdText));
  const matched = resumeSkills.filter((s) => jdSkills.has(s));
  const skillScore = matched.length / Math.max(1, resumeSkills.length);

  const raw = 0.6 * density + 0.4 * skillScore;
  // Density is naturally small; scale so a good match lands ~0.6+.
  const score = Math.min(1, raw * 2);
  return { score: Number(score.toFixed(3)), matched };
}

/** Parse "2-5 years", "3+ yrs", "freshers" → { min, max } (years). */
export function parseExperience(text: string): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };
  const s = text.toLowerCase();
  if (/\b(fresher|entry.level|graduate|new grad)\b/.test(s)) return { min: 0, max: 1 };
  let m = s.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(?:\+)?\s*(?:years?|yrs?)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = s.match(/(\d+)\s*\+\s*(?:years?|yrs?)/);
  if (m) return { min: Number(m[1]), max: null };
  m = s.match(/(?:minimum|min|at least)\s*(\d+)\s*(?:years?|yrs?)/);
  if (m) return { min: Number(m[1]), max: null };
  m = s.match(/(\d+)\s*(?:years?|yrs?)/);
  if (m) return { min: Number(m[1]), max: Number(m[1]) };
  return { min: null, max: null };
}

/** Detect Remote / Hybrid / On-site from JD text + optional isRemote flag. */
export function detectWorkMode(text: string, isRemote?: boolean | null): string {
  const s = (text ?? "").toLowerCase();
  // Handle explicit negation first.
  if (/\b(no|not|non)[\s-]?remote\b/.test(s) || /\bin[- ]?office only\b/.test(s)) return "On-site";
  if (/\bhybrid\b/.test(s)) return "Hybrid";
  if (isRemote === true) return "Remote";
  if (/\b(fully remote|100% remote|work from home|wfh|remote[- ]first)\b/.test(s)) return "Remote";
  if (/\b(on[- ]?site|onsite|in[- ]office|in office)\b/.test(s)) return "On-site";
  return "Not specified";
}
