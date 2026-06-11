import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime SSR (não mais static export): Route Handlers (src/app/api/*) e Middleware
  // exigem servidor. Deploy via Firebase App Hosting (Cloud Run). Dados da Copa vêm
  // do openfootball/worldcup.json (público, sem chave) — ver src/server/copaData.
  trailingSlash: false,

  // next/image em static export não tem servidor de otimização.
  // unoptimized: true delega o redimensionamento ao browser/CDN ou ao processo de build.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
