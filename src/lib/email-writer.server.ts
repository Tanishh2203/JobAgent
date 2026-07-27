// Draft a cold outreach email using Google Gemini directly. Mirrors the Python email_writer.py contract.
import { generateText } from "ai";
import { createGateway, DEFAULT_CHAT_MODEL } from "./ai-gateway.server";

const SYSTEM = `You are drafting a cold outreach email from a job applicant to a hiring contact.

STRUCTURE (follow exactly, in this order):
1. Greeting: "Hi,"
2. Opening line: state the role you're applying for by name. If the candidate's years of experience is BELOW the JD's stated range, honestly and briefly disclose the gap in the same sentence, then move on. Do not dwell on it.
3. "Relevant experience:" followed by 3-4 bullet points. Each bullet starts with a **bolded category** MIRRORED from keywords in THIS specific JD (not generic categories). Use only facts present in the resume text.
4. One-sentence confidence close tying the candidate's strengths to the role.
5. Sign-off line with title + education (pulled from resume).
6. "Resume attached."
7. Signature block: name, email, linkedin, github — pulled from resume text.

HARD RULES:
- Never fabricate skills, tools, metrics, companies, or experience. If it's not in the resume text, it does not go in the email.
- Disclose experience gaps honestly and briefly, then pivot to strengths.
- 150-220 words total.
- No em dashes. No "I hope this finds you well." No filler.
- Plain text only, no markdown headings. Bold via **asterisks** for bullet categories only.

Return ONLY the email body (starting with "Hi,"). Do not include a subject line — that is generated separately.`;

export interface DraftInput {
  resumeText: string;
  jobTitle: string;
  company: string;
  jd: string;
  experienceReq?: string;
}

export interface Draft {
  subject: string;
  body: string;
  model: string;
}

export async function draftEmail(input: DraftInput): Promise<Draft> {
  const model = DEFAULT_CHAT_MODEL;
  const gateway = createGateway();

  const userMsg = `ROLE: ${input.jobTitle}
COMPANY: ${input.company}
JD EXPERIENCE REQUIREMENT: ${input.experienceReq || "not specified"}

JOB DESCRIPTION:
${input.jd.slice(0, 6000)}

RESUME TEXT:
${input.resumeText.slice(0, 6000)}

Draft the email now, following the SYSTEM structure exactly.`;

  const { text } = await generateText({
    model: gateway(model),
    system: SYSTEM,
    prompt: userMsg,
    temperature: 0.6,
  });

  const subject = `Application: ${input.jobTitle} @ ${input.company}`;
  return { subject, body: text.trim(), model };
}
