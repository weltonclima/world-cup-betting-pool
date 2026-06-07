import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Configuração mínima do Vitest para a TASK-07.
// Espelha o alias "@" → ./src do tsconfig para que os imports
// "@/schemas/*" e "@/types/*" funcionem nos testes.
export default defineConfig({
  // Plugin React: transforma JSX nos testes de componente (.tsx),
  // já que o tsconfig usa jsx: "preserve" (esbuild não transforma sozinho).
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    // Ambiente padrão "node" (testes de schema, maioria). Testes de
    // componente (*.test.tsx) declaram `// @vitest-environment jsdom` no topo.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
