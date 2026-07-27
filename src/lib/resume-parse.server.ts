// Server-only PDF text extraction using unpdf (Worker-safe, no native deps).
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : String(text ?? "");
}
