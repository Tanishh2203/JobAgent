// Google Gemini provider (direct, no Lovable Cloud dependency). Server-only.
//
// Get a free API key at https://aistudio.google.com/app/apikey — the free tier
// (as of writing: generous per-minute/per-day request limits on gemini-2.5-flash
// and similar) requires no credit card. Rate limits apply; check current limits
// at https://ai.google.dev/gemini-api/docs/rate-limits since Google changes these.
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function createGateway() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/app/apikey");
  return createGoogleGenerativeAI({ apiKey: key });
}

export const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";
