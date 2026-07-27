// Use this config for Vercel deploys.
// The default vite.config.ts targets Cloudflare Workers via Lovable's plugin.
//
// Usage:
//   vite build --config vite.config.vercel.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Nitro's "vercel" preset emits Vercel's Build Output API v3 format
  // (.vercel/output), which Vercel's platform consumes directly.
  // NOTE: preset must live under top-level `nitro`, not `tanstackStart.server`
  // — the latter is silently ignored by TanStack Start's vite plugin.
  nitro: { preset: "vercel" },
});
