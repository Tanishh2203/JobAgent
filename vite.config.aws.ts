// Use this config for AWS deploys (App Runner / ECS / Elastic Beanstalk / EC2).
// The default vite.config.ts targets Cloudflare Workers via Lovable's plugin.
//
// Usage:
//   NITRO_PRESET=node-server vite build --config vite.config.aws.ts
//
// Or in Docker: the provided Dockerfile does this for you.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
      // Override the Cloudflare default. `node-server` produces a standalone
      // Node server at .output/server/index.mjs that runs on any Node 20+ host.
      // For AWS Lambda, use "aws-lambda" instead.
      preset: process.env.NITRO_PRESET || "node-server",
    },
  },
});
