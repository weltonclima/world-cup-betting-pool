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
    // Fuso fixo para testes de data determinísticos. A lógica de dia (Hoje/
    // Amanhã/agrupamento) opera no fuso LOCAL do dispositivo; sem pin, o
    // resultado dependeria do TZ da máquina/CI. America/Sao_Paulo = UTC−3
    // (sem horário de verão desde 2019), o fuso real dos usuários.
    env: { TZ: "America/Sao_Paulo" },
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
