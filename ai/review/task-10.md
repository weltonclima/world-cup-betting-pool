# REVIEW — TASK-10: Firebase Hosting via Static Export (Opção A)

**Data:** 2026-06-05  
**Revisor:** Claude (gsd-code-reviewer) — adversarial stance  
**Profundidade:** deep  
**Arquivos revisados:** `next.config.ts`, `src/app/page.tsx`, `firebase.json`, `package.json`, `.env.production.example`, `.gitignore`

---

## 1. Task: TASK-10 — Firebase Hosting + deploy + gestão de env

## 2. Resumo

A implementação é **funcionalmente correta** no que tange às alterações de código. O `next.config.ts` está conforme a spec; `src/app/page.tsx` foi corretamente convertido para Client Component com `useRouter().replace`; o `firebase.json` preserva todos os blocos existentes e o JSON é válido; os scripts do `package.json` estão todos presentes e corretos; o `firebase-admin` não é importado por nenhuma página ou componente cliente.

O build `npm run build:hosting` **produz os 9 arquivos HTML esperados** (`index.html`, `home.html`, `login.html`, `pending.html`, `matches.html`, `predictions.html`, `rankings.html`, `profile.html`, `404.html`) e todos os 97 testes passam. Lint e typecheck verdes.

**Encontrado 1 BLOCKER e 2 WARNINGs.**

---

## 3. Positivos

- `next.config.ts`: `output: "export"`, `trailingSlash: false`, `images.unoptimized: true` — exatamente conforme a spec.
- `src/app/page.tsx`: diretiva `"use client"` na linha 1; usa `useEffect` + `useRouter().replace("/home")`; sem nenhum `import` de `redirect`; renderiza `<LoadingScreen />` (melhoria além do spec que dizia `return null` como opção).
- `firebase.json`: JSON válido; blocos `firestore`, `functions`, `emulators` preservados intactos; bloco `hosting` adicionado com `"public": "out"`, `cleanUrls: true`, headers de cache para `/_next/static/**` com `immutable`, `no-cache` para HTML, e headers de segurança globais.
- Scripts do `package.json`: `build:hosting`, `deploy:hosting`, `deploy:functions`, `deploy:rules`, `deploy:all` — todos com `--project world-cup-betting-pool-8e93c` explícito.
- `src/firebase/admin.ts` tem `import "server-only"` na linha 1; nenhuma página ou componente em `src/app/` importa `@/firebase/admin`.
- `out/` contém exatamente os 9 HTML obrigatórios listados nos critérios de aceite.
- `LoadingScreen` implementa `role="status"`, `aria-live="polite"`, `aria-label` e `motion-reduce:animate-none` — qualidade acima do mínimo especificado.

---

## 4. Problemas

### BLOCKER-01: `.env.production.example` é ignorado pelo `.gitignore` — arquivo nunca será commitado

**Arquivo:** `.gitignore:5` + `.env.production.example`

**Problema:**  
A linha `.env*` no `.gitignore` cobre qualquer arquivo cujo nome comece com `.env`. A única exceção declarada é `!.env.local.example`. O arquivo `.env.production.example` — que a spec (seção 5.3) exige que seja **commitado como referência de configuração de produção** — é ignorado por esse padrão.

Verificação concreta:
```
$ git check-ignore -v .env.production.example
.gitignore:5:.env*    .env.production.example
```
O arquivo não aparece em `git ls-files --others --exclude-standard`, confirmando que está sendo filtrado.

**Impacto:** qualquer desenvolvedor que fizer clone do repositório não terá o template de variáveis de produção. A nota explícita sobre `FIREBASE_SERVICE_ACCOUNT_KEY` (não pertence ao build de hosting) e os nomes exatos das variáveis `NEXT_PUBLIC_*` não estarão disponíveis. O critério de aceite "`.env.production.example` criado na raiz" estará tecnicamente presente no filesystem local, mas ausente do repositório — que é onde importa.

**Correção:**  
Adicionar linha de negação ao `.gitignore` imediatamente após a linha existente de exceção:

```diff
 .env*
 !.env.local.example
+!.env.production.example
```

---

### WARNING-01: Build de `npm run build:hosting` é intermitentemente instável com `.next/` em estado inconsistente

**Arquivo:** `package.json:21` (script `build:hosting`)

**Problema:**  
Durante a revisão, `npm run build:hosting` falhou em 4 das 6 execuções consecutivas com erros distintos (`ENOENT: pages-manifest.json`, `Cannot find module middleware-manifest.json`, `Unexpected end of JSON input`, `pages-manifest.json not found`) quando o diretório `.next/` estava em estado parcial ou stale de uma execução anterior interrompida. O build só passou de forma confiável após limpeza do `.next/`.

O script `build:hosting` invoca apenas `next build`, sem limpeza prévia. Isso é um padrão frágil em ambientes onde builds anteriores podem ter sido interrompidos (CI/CD, Ctrl+C local, falhas de rede em build paralelos).

**Impacto:** falsos negativos no CI/CD e confusão para desenvolvedores que executem o build sem limpar o cache.

**Correção recomendada:**

```json
"build:hosting": "rimraf .next out && next build"
```

Ou, se `rimraf` não estiver disponível, usar o built-in do `next`:
```json
"build:hosting": "next build"
```
acompanhado de documentação explícita no README de que `.next/` deve ser limpo antes de um build limpo. A solução mais robusta é incluir a limpeza no script.

**Nota:** `rimraf` já pode ser adicionado como devDependency ou usar `rm -rf .next out` (Unix) / `rd /s /q .next out` (Windows). Em ambiente cross-platform, o pacote `rimraf` é preferível.

---

### WARNING-02: `firebase-admin` em `dependencies` (não `devDependencies`) no projeto frontend

**Arquivo:** `package.json:36`

**Problema:**  
O pacote `firebase-admin` (v13.10.0) está listado em `dependencies`, não em `devDependencies`. Em um projeto com `output: "export"` (estático puro), o `firebase-admin` nunca deve ser incluído no bundle de produção — ele é exclusivamente server-side e seu uso no projeto raiz serve apenas para o arquivo `src/firebase/admin.ts`, que tem `import "server-only"`.

A proteção atual (`import "server-only"` no `admin.ts`) impede que o bundle do browser inclua o admin SDK. No entanto, colocar `firebase-admin` em `dependencies` significa que:

1. Ele é instalado em produção com `npm install --omit=dev` (cenários de CI/CD que otimizam instalação).
2. Cria ambiguidade arquitetural: para um revisor externo ou CI, sugere que o package principal tem dependência de runtime em servidor.
3. O `firebase-admin` para o projeto frontend deveria estar no `package.json` da pasta `functions/`, não na raiz.

**Impacto:** baixo em runtime (o `server-only` guarda adequadamente), mas alto em clareza arquitetural e potencialmente problemático em pipelines de CI que façam `npm ci --omit=dev` para o build de hosting.

**Correção:**  
Mover `firebase-admin` de `dependencies` para `devDependencies` na raiz — ou removê-lo da raiz completamente, deixando-o apenas em `functions/package.json` (onde ele realmente é usado em runtime).

```json
// devDependencies (ou remover da raiz)
"firebase-admin": "13.10.0"
```

---

## 5. Riscos

- O risco T8 da spec ("out/ commitado acidentalmente") está **mitigado**: `/out/` está no `.gitignore:3`.
- O risco T4 ("service account vazado no bundle") está **mitigado**: `admin.ts` tem `import "server-only"`; nenhuma página/componente importa o admin SDK.
- O risco T5 ("deploy acidental em produção") está **mitigado**: scripts têm `--project` explícito; nenhum `firebase deploy` foi executado nesta task.
- BLOCKER-01 mantém o risco T3 parcialmente aberto: se `.env.production.example` não for commitado, desenvolvedores não terão referência das variáveis necessárias e o build de produção pode falhar silenciosamente com valores ausentes.

---

## 6. Ajustes necessários para aprovação

1. **[BLOCKER-01]** Adicionar `!.env.production.example` ao `.gitignore` (1 linha).
2. **[WARNING-01]** Adicionar limpeza de `.next/` e `out/` ao script `build:hosting` para builds confiáveis.
3. **[WARNING-02]** Mover `firebase-admin` de `dependencies` para `devDependencies` na raiz.

---

## 7. Resultado do `npm run build:hosting`

Após limpeza do `.next/` (necessária por BLOCKER-01 adjacente ao WARNING-01):

```
✓ Compiled successfully
✓ Generating static pages (11/11)
✓ Exporting (2/2)

Route (app)                  Size    First Load JS
┌ ○ /                       595 B        103 kB
├ ○ /_not-found             994 B        103 kB
├ ○ /home                   137 B        102 kB
├ ○ /login                  137 B        102 kB
├ ○ /matches                137 B        102 kB
├ ○ /pending               3.85 kB       257 kB
├ ○ /predictions            137 B        102 kB
├ ○ /profile                137 B        102 kB
└ ○ /rankings               137 B        102 kB
○ (Static) prerendered as static content
```

HTML gerados em `out/`: `index.html`, `home.html`, `login.html`, `matches.html`, `pending.html`, `predictions.html`, `profile.html`, `rankings.html`, `404.html` — todos os 9 obrigatórios presentes.

Testes: **97/97 passando**. Lint: **limpo**. Typecheck: **limpo**.

---

## 8. Verdict: **rejected**

Um BLOCKER impede aprovação: `.env.production.example` está sendo ignorado pelo `.gitignore` e nunca será commitado, violando diretamente o critério de aceite da spec. A correção é trivial (1 linha no `.gitignore`), mas deve ser aplicada antes que esta task seja considerada concluída.
