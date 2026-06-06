# DEBUG SESSION

## 1. Bug: todas as rotas retornam 500 (Internal Server Error)

## 2. Observação (sintoma preciso)
- `GET /login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha` → **HTTP 500** (corpo = "Internal Server Error", 21 bytes).
- Atinge rotas **pré-existentes** (login/cadastro), não só as novas → falha **global**, não da feature.
- Stack real (terminal do dev server, turbopack):
  ```
  Error: Cannot find module '../chunks/ssr/[turbopack]_runtime.js'
  Require stack: ...\.next\server\pages\_document.js
  [Error: ENOENT ...\.next\server\app\(auth)\login\page\app-build-manifest.json]
  [Error: ENOENT ...\.next\static\development\_buildManifest.js.tmp.<rand>]
  ```
- As páginas **compilam** com sucesso (`✓ Compiled /esqueci-senha`, `✓ Compiled /redefinir-senha`).

## 3. Reprodução
Sempre, enquanto o `.next` estiver no estado misto. Curl em qualquer rota → 500.

## 4. Hipóteses consideradas
- H1: `env.ts` lançando no import (envs faltando) → **REFUTADA**. `.env.local` tem todas as `NEXT_PUBLIC_*`; erro real não é de env; build passava.
- H2: bug nas telas novas (Suspense/useSearchParams) → **REFUTADA**. Login/cadastro (sem essas telas) também 500; e as novas rotas compilam OK no log.
- H3: `.next` corrompido por mistura de `next build` (webpack) com `next dev --turbopack` → **CONFIRMADA**. Presença de `.next/server/pages/_document.js` (artefato pages/webpack) + `Cannot find module '[turbopack]_runtime.js'` = runtime turbopack ausente porque a pasta foi escrita por toolchains diferentes.
- H4: dois dev servers escrevendo no mesmo `.next` → **CONFIRMADA (contribuinte)**. Foi iniciado um 2º `next dev -p 3137` concorrente com o `npm run dev` (3000); os `_buildManifest.js.tmp.<rand>` ENOENT são corrida de escrita/rename de arquivos temporários no mesmo `.next`.

## 5. Root cause
`.next` ficou em estado inconsistente por DOIS fatores introduzidos durante a sessão de validação:
1. **`next build` (webpack)** rodado para "verify"/"local-env" gravou artefatos do Pages Router (`server/pages/_document.js`) e layout de produção no MESMO `.next` que o `next dev --turbopack` do usuário usa para desenvolvimento. Turbopack então procura `chunks/ssr/[turbopack]_runtime.js` que o build webpack não produz → `MODULE_NOT_FOUND` → 500.
2. **Segundo dev server concorrente** (porta 3137) escrevendo no mesmo `.next` → corrida nos arquivos `*.tmp.<rand>` (ENOENT no rename) no Windows.

Não é bug de código da feature — é contaminação de artefatos de build/tooling.

## 6. Fix
- **Não é alteração de código.** Limpar o diretório de build e rodar um único servidor:
  1. Parar o(s) dev server(s) (Ctrl+C).
  2. `rm -rf .next` (PowerShell: `Remove-Item -Recurse -Force .next`).
  3. `npm run dev` (um só).
- **Prevenção:** não rodar `next build` nem um 2º `next dev` contra a mesma working tree enquanto o `next dev --turbopack` do usuário estiver ativo. Para checagens, usar diretório/porta isolados ou pedir que o usuário pare o dev antes do build.

## 7. Verificação
- Após `rm -rf .next` + `npm run dev`: as rotas compilam e respondem 200 (os logs já mostram compilação OK; o 500 vinha só dos artefatos órfãos).
- Suíte de testes (206) e `tsc` continuam verdes — fix não toca código.

## 8. Lições / padrões
- 500 global (rotas antigas inclusas) logo após mudanças de tooling → suspeitar de `.next`/artefatos, não do código novo.
- Ler o stack REAL (terminal do turbopack) antes de hipotetizar; a resposta HTTP "Internal Server Error" (21 bytes) não traz stack.
- `next build` (webpack) e `next dev --turbopack` **não compartilham `.next`** com segurança. Um corrompe o outro.
- Nunca subir um 2º dev server na mesma working tree do usuário.
