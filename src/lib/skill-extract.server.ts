// LLM-based resume/JD skill extraction (Gemini), with a keyword-vocab fallback
// for when the API key is missing or the call fails. Server-only.
import { generateObject } from "ai";
import { z } from "zod";
import { createGateway, DEFAULT_CHAT_MODEL } from "./ai-gateway.server";
import { extractSkills as extractSkillsFromVocab } from "./skill-vocab";

const SYSTEM = `You extract a professional's skills from resume text.

Return every concrete skill: programming languages, frameworks, libraries, tools, platforms,
databases, cloud services, and clearly-named domain/soft skills (e.g. "project management").

RULES:
- Only list skills actually evidenced in the text. Never invent or infer skills that aren't present.
- Use short, canonical names (e.g. "React" not "React.js library", "PostgreSQL" not "Postgres DB experience").
- Deduplicate case/spelling variants into one canonical form.
- Do not include job titles, company names, soft filler phrases ("hard worker"), or full sentences.
- Cap the list at 60 skills; prioritize the most concrete/specific ones if there are more.`;

const SkillsSchema = z.object({
  skills: z.array(z.string().min(1).max(60)),
});

async function extractSkillsWithGemini(text: string): Promise<string[]> {
  const gateway = createGateway();
  const { object } = await generateObject({
    model: gateway(DEFAULT_CHAT_MODEL),
    schema: SkillsSchema,
    system: SYSTEM,
    prompt: text.slice(0, 12000),
  });
  const normalized = object.skills
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  return Array.from(new Set(normalized)).sort();
}

/**
 * Extract skills from free text (resume or JD). Tries Gemini first for broad,
 * non-hardcoded coverage; falls back to the static keyword vocab if the LLM
 * call fails (missing key, rate limit, network error) so uploads never hard-fail.
 */
export async function extractSkills(text: string): Promise<string[]> {
  try {
    return await extractSkillsWithGemini(text);
  } catch (err) {
    console.error("Gemini skill extraction failed, falling back to keyword vocab:", err);
    return extractSkillsFromVocab(text);
  }
}
