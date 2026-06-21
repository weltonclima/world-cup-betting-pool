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

  // Headers do PWA (App Hosting serve o Next; headers de firebase.json/hosting são
  // legado de static export e não se aplicam ao runtime SSR).
  async headers() {
    return [
      {
        // SW precisa de escopo raiz e NÃO pode ser cacheado (senão app velho gruda).
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        // SW de FCM (web-push-pwa TASK-02): mesmo cuidado de cache do /sw.js —
        // se cacheado, a config/SDK inline gruda velha após deploy (push/click
        // rodam código obsoleto).
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
