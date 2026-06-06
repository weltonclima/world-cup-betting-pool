import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera saída estática em out/ (HTML + assets, sem servidor Node).
  // Compatível com Firebase Hosting CDN (Opção A — static export).
  output: "export",

  // URLs sem extensão (.html) — Firebase Hosting usa cleanUrls: true no firebase.json.
  trailingSlash: false,

  // next/image em static export não tem servidor de otimização.
  // unoptimized: true delega o redimensionamento ao browser/CDN ou ao processo de build.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
