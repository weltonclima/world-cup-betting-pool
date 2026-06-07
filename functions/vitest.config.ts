import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
  resolve: {
    alias: {
      // Alias para schemas compartilhados dentro do subprojeto functions/
      "#shared": resolve(__dirname, "src/shared"),
    },
  },
});
