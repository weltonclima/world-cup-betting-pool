import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime SSR (não mais static export): Route Handlers (src/app/api/*) e Middleware
  // exigem servidor. Deploy via Firebase App Hosting (Cloud Run) — config apphosting.yaml
  // + secret API_FOOTBALL_KEY pendentes na TASK-07b. Ver ai/plan/integracao-api-football.md.
  trailingSlash: false,

  // next/image em static export não tem servidor de otimização.
  // unoptimized: true delega o redimensionamento ao browser/CDN ou ao processo de build.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
