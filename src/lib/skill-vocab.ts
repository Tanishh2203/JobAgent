// Keyword-based skill vocabulary. Used only as a fallback when Gemini extraction
// (see skill-extract.server.ts) is unavailable — e.g. missing GEMINI_API_KEY or a
// failed API call. Kept intentionally focused on AI/ML/backend/data.
export const SKILL_VOCAB: readonly string[] = [
  // languages
  "python", "typescript", "javascript", "java", "c++", "c#", "go", "rust", "sql", "bash",
  // ai/ml
  "pytorch", "tensorflow", "keras", "scikit-learn", "sklearn", "hugging face", "huggingface",
  "transformers", "langchain", "llamaindex", "rag", "llm", "llms", "prompt engineering",
  "fine-tuning", "fine tuning", "embeddings", "vector database", "pinecone", "chromadb",
  "faiss", "weaviate", "openai", "anthropic", "claude", "gpt", "gemini", "ollama",
  "nlp", "computer vision", "cv", "opencv", "yolo", "diffusion", "stable diffusion",
  // data
  "pandas", "numpy", "scipy", "matplotlib", "seaborn", "plotly", "spark", "hadoop",
  "airflow", "dbt", "snowflake", "bigquery", "redshift", "databricks",
  // backend / web
  "fastapi", "flask", "django", "node", "node.js", "nodejs", "express", "nestjs",
  "next.js", "nextjs", "react", "vue", "svelte", "graphql", "rest", "grpc", "websockets",
  // infra / devops
  "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "terraform", "ansible",
  "ci/cd", "github actions", "jenkins", "linux", "nginx",
  // databases
  "postgres", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite", "supabase",
  // ml ops
  "mlflow", "wandb", "weights & biases", "kubeflow", "sagemaker", "vertex ai",
  // tools
  "git", "jira", "streamlit", "gradio",
] as const;

/** Extract normalized skills from any free text using a simple word-boundary scan. */
export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const skill of SKILL_VOCAB) {
    // Escape regex metachars in skill (e.g. c++, node.js).
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9+#.-])${escaped}(?:$|[^a-z0-9+#.-])`, "i");
    if (re.test(lower)) hits.add(skill);
  }
  return Array.from(hits).sort();
}
