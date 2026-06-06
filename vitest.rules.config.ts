import { defineConfig } from "vitest/config";

// Configuração dedicada aos testes de Security Rules (TASK-08).
// Separada do vitest.config.ts padrão (que cobre apenas src/**) porque
// estes testes:
//  - vivem em test/rules (fora de src/), são testes de infraestrutura;
//  - SÓ rodam dentro do emulador do Firestore (via `npm run test:rules`),
//    portanto NÃO podem entrar no `npm test` padrão (que deve ser rápido
//    e não exigir o emulador/Java).
// Ambiente "node": @firebase/rules-unit-testing não precisa de jsdom.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/rules/**/*.test.ts"],
  },
});
