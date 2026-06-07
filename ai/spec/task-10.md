# SPEC — TASK-10: Firebase Hosting + deploy + gestão de env

> Entrada: `ai/plan/feature.md` (TASK-10) + `ai/prd/feature.md` (risco R3, baixo custo, < 100 usuários) + `.claude/CLAUDE.md` (Firebase Hosting, mobile-first, custo baixo).
> Tipo: `infra` · Criticidade: `medium` · Risco técnico: `medium` · Story points: 3.
> TDD: não · Screen: não · Dependências: **TASK-05** (Firebase init) + **TASK-09** (Cloud Functions).

---

## 1. Objetivo e decisão de hosting (Opção A vs. B)

Esta task configura o pipeline de deploy do Next.js 15 no Firebase Hosting e estabelece a gestão de ambientes (dev/prod). O objetivo central é **resolver o risco R3** do PRD — "Next 15 SSR no Firebase Hosting exige frameworks-aware hosting ou adapter" — e entregar um `firebase.json` completo e scripts de build/deploy prontos para uso.

### 1.1 As duas opções avaliadas

**Opção A — Static Export + Firebase Hosting clássico (CDN pura)**

`output: 'export'` no `next.config.ts` instrui o Next a gerar HTML/CSS/JS estáticos na pasta `out/`. O Firebase Hosting serve esses arquivos como CDN clássica, sem nenhum servidor Node, Cloud Run ou Container. Custo: praticamente zero (apenas storage e transferência, dentro do plano Spark gratuito para < 100 usuários). Limitações: sem SSR real, sem `server actions`, sem `redirect()` no servidor (a página raiz atual usa `redirect("/home")` — ver seção 7), sem otimização de imagem via servidor (`next/image` requer `unoptimized: true`), sem Route Handlers server-side (podem ser substituídos pelas Cloud Functions já previstas em TASK-09).

**Opção B — Firebase App Hosting (frameworks-aware, Cloud Run)**

O Firebase App Hosting detecta automaticamente projetos Next.js e gerencia a build, o deploy e a execução SSR via Cloud Run. Suporta Server Components, Server Actions, `redirect()` nativo e todo o conjunto do App Router. Custo mais alto: Cloud Run cobra por requisição/CPU além dos limites gratuitos, e a complexidade operacional é maior (build remoto, IAM, configuração de secrets no App Hosting).

### 1.2 Decisão: **Opção A recomendada**

A arquitetura do Bolão dos Parças é **100% client-rendered** por design: toda a lógica de servidor está nas Cloud Functions (TASK-09), a autenticação e o carregamento de dados são feitos via Firebase SDK no browser, e os guards de rota (`AuthGuard`, `PendingApprovalScreen`) são componentes `"use client"`. **Não existe nenhum Server Component com data fetching, nenhuma Server Action e nenhuma necessidade de SSR** nas rotas atuais ou planejadas no MVP.

Razões objetivas para escolher a Opção A:

| Critério | Opção A (static export) | Opção B (App Hosting) |
|---|---|---|
| Custo mensal (< 100 usuários) | ~$0 (Spark / Blaze com free tier) | Variável — Cloud Run consome cota além do gratuito em uso real |
| Complexidade de config | Baixa — `firebase.json` + `out/` | Alta — App Hosting YAML, IAM, build remoto |
| Compatibilidade com a arquitetura atual | Total — app é SPA/CSR sobre static shell | Desnecessário — não há SSR a executar |
| Tempo de build e deploy | Rápido — `next build` local + `firebase deploy` | Mais lento — build remoto no Cloud Run |
| Hard dependency de SSR | Nenhuma | — |
| Risco operacional | Baixo | Médio (Cloud Run cold start, IAM misconfiguration) |

A única ressalva da Opção A é o `redirect("/home")` em `src/app/page.tsx`, que usa a API de servidor do Next. A seção 7 especifica a substituição por um client redirect, resolvendo o problema sem nenhuma perda funcional.

> **Premissa futura:** se features posteriores exigirem SSR real (Server Components com fetch privilegiado, geração de OG images server-side, etc.), a migração para Firebase App Hosting pode ser feita de forma incremental sem reescrever o frontend. Esta spec documenta o caminho de saída na seção 9 (riscos).

---

## 2. Alterações em `next.config.ts`

O `next.config.ts` atual está vazio (`{}`). As seguintes opções devem ser adicionadas para habilitar o static export compatível com Firebase Hosting:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera saída estática em out/ (HTML + assets, sem servidor Node).
  // Compatível com Firebase Hosting CDN (Opção A).
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
```

**Por que `trailingSlash: false`:** o Firebase Hosting com `cleanUrls: true` resolve `/home` para `out/home.html` sem barra final. Manter `false` garante que os links internos do app gerem URLs sem `/home/`, alinhado ao comportamento atual do App Router.

**Por que `images.unoptimized: true`:** a otimização de imagem do Next.js (`next/image` com `loader: 'default'`) depende de um endpoint de servidor (`/_next/image?url=...`) que não existe em static export. Com `unoptimized: true` o componente emite a `<img>` com a `src` original, sem redirecionar para o servidor. Para o Bolão (< 100 usuários, imagens majoritariamente ícones/avatares pequenos), isso é aceitável.

**API Routes / Route Handlers:** com `output: 'export'`, Route Handlers (`app/api/*/route.ts`) não são exportados como HTML e **não funcionam** em static export. Isso não é problema: toda a lógica server-side já está (ou estará) nas Cloud Functions (TASK-09). Qualquer Route Handler criado futuramente deve ser migrado para Cloud Function.

---

## 3. `firebase.json` — bloco de hosting

O `firebase.json` atual já contém `firestore`, `functions` e `emulators` (configurados em TASK-05/TASK-09). A task adiciona o bloco `"hosting"` sem remover nem alterar os blocos existentes.

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions"
  },
  "hosting": {
    "public": "out",
    "cleanUrls": true,
    "trailingSlash": false,
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [
      {
        "source": "/_next/static/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=0, must-revalidate"
          }
        ]
      },
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Frame-Options",
            "value": "SAMEORIGIN"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          }
        ]
      }
    ]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

**Explicação das escolhas:**

- `"public": "out"` — diretório gerado pelo `next build` com `output: 'export'`. Padrão do Next.
- `"cleanUrls": true` — serve `/home` em vez de `/home.html`. Essencial para o App Router onde as rotas não têm extensão.
- `"trailingSlash": false` — consistente com a configuração do `next.config.ts`.
- `"ignore"` — evita subir `firebase.json`, dotfiles e `node_modules` para o CDN.
- Headers `/_next/static/**` com `immutable` — os assets estáticos do Next têm hash no nome (`_next/static/chunks/abc123.js`), portanto podem ser cacheados por 1 ano com segurança total.
- Headers `**/*.html` com `no-cache` — os arquivos HTML são o ponto de entrada do SPA; devem ser sempre revalidados para garantir que o usuário receba a versão mais recente após um deploy.
- Headers de segurança (`X-Frame-Options`, `X-Content-Type-Options`) aplicados globalmente.
- **Sem bloco `rewrites`:** não há SSR nem API Routes para redirecionar. O SPA faz todo o roteamento client-side via React Router (App Router com `useRouter`). Em static export, o Next gera um arquivo HTML por rota — não é um SPA de arquivo único (single `index.html`), então não é necessário rewrite `**` → `index.html`.

> **Nota sobre `404.html`:** o Next com `output: 'export'` gera automaticamente um `out/404.html`. O Firebase Hosting serve esse arquivo para rotas não encontradas por padrão.

---

## 4. Scripts de build e deploy

Adicionar ao bloco `"scripts"` do `package.json`, preservando os scripts existentes:

```json
{
  "scripts": {
    "build:hosting": "next build",
    "deploy:hosting": "firebase deploy --only hosting --project world-cup-betting-pool-8e93c",
    "deploy:functions": "firebase deploy --only functions --project world-cup-betting-pool-8e93c",
    "deploy:rules": "firebase deploy --only firestore:rules,firestore:indexes --project world-cup-betting-pool-8e93c",
    "deploy:all": "firebase deploy --project world-cup-betting-pool-8e93c"
  }
}
```

**Fluxo de build + deploy (manual, pós-configuração):**

```bash
# 1. Garantir que .env.production está preenchido (seção 5)
# 2. Buildar o static export
npm run build:hosting
# → Gera out/ com todos os arquivos HTML/CSS/JS

# 3. (Opcional) Pré-visualizar localmente antes de subir
firebase hosting:channel:deploy preview-$(date +%Y%m%d) --project world-cup-betting-pool-8e93c --expires 1d

# 4. Deploy de hosting (apenas após confirmação do usuário — ver seção 8)
npm run deploy:hosting

# 5. Deploy de regras Firestore (se alteradas)
npm run deploy:rules

# 6. Deploy de functions (se alteradas)
npm run deploy:functions

# 7. Deploy completo (hosting + functions + firestore)
npm run deploy:all
```

**Por que `--project world-cup-betting-pool-8e93c` explícito:** garante que nenhum deploy acidental vai para o projeto errado mesmo se o `.firebaserc` ou `firebase use` estiver em estado diferente. O projeto real está definido em `.firebaserc` (`"default": "world-cup-betting-pool-8e93c"`), mas a flag explícita é uma segunda camada de segurança.

---

## 5. Gestão de variáveis de ambiente (dev/prod)

### 5.1 Princípios fundamentais

- Variáveis `NEXT_PUBLIC_*` são **injetadas em tempo de build** pelo Next.js — são literalmente embarcadas no bundle JS/HTML que vai para o CDN. Não são segredos e não podem ser alteradas pós-deploy.
- Variáveis sem prefixo `NEXT_PUBLIC_` (ex.: `FIREBASE_SERVICE_ACCOUNT_KEY`) são **server-side** e jamais chegam ao static export ou ao browser. São usadas exclusivamente pelas Cloud Functions.
- O `.env.local` (desenvolvimento local) nunca é commitado.
- O `.env.production` nunca é commitado (apenas `.env.production.example`).

### 5.2 Ambientes

| Arquivo | Quando é lido | Commitado? |
|---|---|---|
| `.env.local` | `next dev` + `next build` local (override sobre os outros) | Não |
| `.env.local.example` | Referência para devs | Sim |
| `.env.production` | `next build` em CI/produção (quando não há `.env.local`) | Não |
| `.env.production.example` | Referência para configuração de produção | Sim |

### 5.3 `.env.production.example`

Criar o arquivo `.env.production.example` na raiz do projeto:

```bash
# ============================================================
# Bolão dos Parças — Variáveis de Produção (TASK-10)
# Copie para .env.production e preencha com os valores reais
# do projeto Firebase world-cup-betting-pool-8e93c.
# NUNCA commitar .env.production com valores reais.
# ============================================================

# --- CLIENT SDK (público — embarcadas no bundle, NÃO são segredos) ---
# Obtidas em: Firebase Console → Project settings → Your apps → Web app
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=world-cup-betting-pool-8e93c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Emuladores: SEMPRE false em produção.
NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false

# --- ADMIN SDK (SERVER-ONLY — usadas apenas pelas Cloud Functions) ---
# NÃO são necessárias para o build do hosting (static export).
# Configurar apenas no ambiente de execução das Cloud Functions (functions/.env).
# FIREBASE_SERVICE_ACCOUNT_KEY=   ← NÃO vai aqui; vai em functions/.env ou Secret Manager
```

**Separação crítica:** o service account (`FIREBASE_SERVICE_ACCOUNT_KEY`) é uma credencial server-side que **nunca deve ser incluída** no `.env.production` usado pelo `next build`. Ele só é lido pelo admin SDK nas Cloud Functions, e deve ser configurado no ambiente de execução das Functions (arquivo `functions/.env` ou Google Cloud Secret Manager), nunca no frontend.

### 5.4 Como injetar variáveis no build de produção (fluxo manual)

```bash
# Opção 1: arquivo .env.production (local, não commitado)
cp .env.production.example .env.production
# → Preencher manualmente com valores reais do Console
npm run build:hosting

# Opção 2: variáveis de ambiente inline (CI/CD)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx \
NEXT_PUBLIC_FIREBASE_PROJECT_ID=world-cup-betting-pool-8e93c \
... \
npm run build:hosting
```

### 5.5 Verificação pós-build

Após `npm run build:hosting`, verificar se as variáveis foram injetadas:

```bash
# Inspecionar um chunk JS para confirmar que o project ID está presente
grep -r "world-cup-betting-pool-8e93c" out/_next/static/chunks/ | head -5
# → Deve encontrar ocorrências (confirma que NEXT_PUBLIC_FIREBASE_PROJECT_ID foi injetado)
```

---

## 6. Preview local com emulador de hosting

O Firebase Hosting pode ser testado localmente de duas formas, **sem realizar deploy de produção**.

### 6.1 Emulador de hosting (integrado com emuladores de Auth e Firestore)

```bash
# Passo 1: buildar o static export localmente
npm run build:hosting
# → Gera out/

# Passo 2: subir o conjunto completo de emuladores (incluindo hosting na porta 5000)
firebase emulators:start --project demo-bolao-dos-parcas
# → Hosting: http://localhost:5000
# → Firestore: http://localhost:8080
# → Auth: http://localhost:9099
# → UI do emulador: http://localhost:4000
```

O emulador de hosting serve os arquivos de `out/` (conforme `"public": "out"` no `firebase.json`) na porta 5000, exatamente como o Firebase Hosting real. Isso inclui `cleanUrls`, `trailingSlash` e os headers configurados.

### 6.2 Preview channel (pré-visualização remota sem afetar produção)

O Firebase Hosting suporta **preview channels** — URLs temporárias e isoladas do canal de produção (`hosting`):

```bash
# Requer build:hosting já executado (out/ existe)
firebase hosting:channel:deploy preview-local \
  --project world-cup-betting-pool-8e93c \
  --expires 1d
# → Gera URL como: https://world-cup-betting-pool-8e93c--preview-local-xxxxxxxx.web.app
# → Expira em 1 dia; não afeta o canal de produção
```

Esta abordagem permite validar a build com as variáveis reais de produção sem publicar no domínio principal. É o **passo recomendado antes de qualquer deploy em produção**.

---

## 7. O `redirect("/home")` na página raiz — análise e correção

### 7.1 O problema

O arquivo `src/app/page.tsx` contém:

```ts
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/home");
}
```

A função `redirect()` importada de `"next/navigation"` — quando usada em um Server Component (arquivo sem `"use client"`) — é uma **função de servidor** que emite um HTTP 302 durante o SSR. Com `output: 'export'`, o Next tenta executar `redirect()` em build time para gerar o arquivo `out/index.html`, mas **`redirect()` de servidor não é suportado em static export** e causará erro de build:

```
Error: `redirect()` is not supported during static generation.
```

### 7.2 A correção especificada

Substituir a implementação server-side por um **Client Component com redirecionamento client-side**:

```tsx
// src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Página raiz — redireciona para a home interna via client-side router.
 * Necessário em static export (output: 'export'), que não suporta redirect()
 * de servidor (Server Component). O AuthGuard na rota /home cuida da
 * verificação de autenticação: usuário não autenticado é redirecionado para /login.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/home");
  }, [router]);

  // Retorna null enquanto o redirect acontece.
  // Considerar um <LoadingScreen /> para evitar flash de tela em branco.
  return null;
}
```

**Por que `router.replace` em vez de `router.push`:** `replace` não adiciona a rota raiz `/` ao histórico do browser, impedindo que o usuário volte a ela via botão "Voltar".

**Impacto na UX:** haverá um ciclo de render antes do redirecionamento (client-side). Para evitar flash de tela branca, o componente pode renderizar um `<LoadingScreen />` enquanto o efeito dispara. O `AuthGuard` em `/home` já lida com todos os estados de autenticação, portanto a lógica de redirecionamento existente permanece intacta.

**Compatibilidade com rotas de grupo:** as rotas `(app)/home`, `(app)/matches`, etc. e `(auth)/login`, `(auth)/pending` são **route groups** do App Router e continuam gerando arquivos HTML estáticos normalmente (`out/home.html`, `out/login.html`, etc.) — os parênteses nos nomes de diretório não afetam os URLs gerados, apenas a organização do layout. O `AuthGuard` é um Client Component (`"use client"`) e funciona idêntico em static export.

---

## 8. Critérios de aceite

Para considerar esta task concluída, **todos** os itens abaixo devem ser verificados:

- [ ] `next.config.ts` contém `output: "export"`, `trailingSlash: false` e `images.unoptimized: true`.
- [ ] `src/app/page.tsx` usa `"use client"` + `useRouter().replace("/home")` e não importa `redirect` de `"next/navigation"`.
- [ ] `npm run build:hosting` executa `next build` com sucesso e gera o diretório `out/` com os arquivos HTML de todas as rotas.
- [ ] O diretório `out/` contém pelo menos: `index.html`, `home.html`, `login.html`, `pending.html`, `matches.html`, `predictions.html`, `rankings.html`, `profile.html`, `404.html`.
- [ ] `firebase.json` inclui o bloco `"hosting"` com `"public": "out"`, `"cleanUrls": true`, headers de cache e segurança, sem remover os blocos `firestore`, `functions` e `emulators`.
- [ ] `firebase.json` é válido conforme `firebase deploy --only hosting --dry-run` ou `firebase hosting:channel:deploy` retorna sem erros de schema.
- [ ] Scripts `build:hosting`, `deploy:hosting`, `deploy:functions`, `deploy:rules` e `deploy:all` estão presentes no `package.json`.
- [ ] `.env.production.example` criado na raiz com as variáveis `NEXT_PUBLIC_FIREBASE_*` e nota explícita de que `FIREBASE_SERVICE_ACCOUNT_KEY` não pertence aqui.
- [ ] `npm run typecheck` e `npm run lint` verdes após as alterações.
- [ ] **Preview local verificado:** `firebase emulators:start --project demo-bolao-dos-parcas` sobe o hosting na porta 5000 e serve a aplicação sem erros (requer `out/` gerado).
- [ ] **Deploy de produção NÃO executado nesta task** — documentado como passo manual pós-confirmação (seção 4, fluxo de deploy).

### 8.1 Verificação do emulador de hosting (script de smoke test)

```bash
# Sequência de verificação local completa
npm run build:hosting
# → Esperado: "Route (app)" tabela com todas as rotas, "○ (Static) prerendered as static content"

firebase emulators:start --project demo-bolao-dos-parcas &
EMULATOR_PID=$!
sleep 5

curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/home
# → Esperado: 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/login
# → Esperado: 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/rota-que-nao-existe
# → Esperado: 404

kill $EMULATOR_PID
```

---

## 9. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| **R3** | Next 15 SSR no Firebase Hosting | Média | **Resolvido** pela Opção A (static export). O único ponto de atenção — `redirect()` server-side — é corrigido na seção 7. |
| T1 | `redirect()` de servidor quebra o build em static export | Alta | Substituição por client redirect com `useRouter().replace` (seção 7). |
| T2 | Route Handlers (`app/api/*`) não funcionam em static export | Média | Toda a lógica server-side está nas Cloud Functions (TASK-09). Documentar que novos Route Handlers devem ser criados como Cloud Functions. |
| T3 | Variáveis `NEXT_PUBLIC_*` ausentes no build de produção | Alta | `.env.production.example` documenta todas as variáveis; seção 5.5 descreve verificação pós-build; build falha com erro Zod descritivo se faltarem. |
| T4 | Service account vazado no bundle do frontend | Alta | A variável `FIREBASE_SERVICE_ACCOUNT_KEY` é documentada explicitamente como server-side (Functions); o `.env.production.example` contém comentário explícito proibindo seu uso no build de hosting. |
| T5 | Deploy acidental em produção | Média | Scripts com `--project` explícito; deploy de produção documentado como **passo manual** requerendo confirmação humana; uso de preview channels antes do deploy. |
| T6 | Imagens degradadas com `unoptimized: true` | Baixa | Para < 100 usuários com imagens majoritariamente ícones SVG/pequenos PNGs, impacto é negligenciável. Se necessário futuramente, usar um image CDN externo (Cloudinary, etc.). |
| T7 | Necessidade futura de SSR | Baixa | Documentada como caminho de migração: adotar Firebase App Hosting (Opção B) removendo `output: 'export'` do `next.config.ts`. A migração não exige reescrita de componentes, apenas remoção de `unoptimized: true` e client redirect. |
| T8 | `out/` commitado acidentalmente | Baixa | Garantir que `out/` está no `.gitignore` (verificar e adicionar se ausente). |

### 9.1 Premissas

- O projeto real no Firebase Console (`world-cup-betting-pool-8e93c`) já existe e está configurado (pré-requisito de TASK-05).
- A pasta `functions/` existe e `firebase.json` já contém `"functions": { "source": "functions" }` (entregue em TASK-09).
- O plano de billing do Firebase suporta `firebase deploy` — o Spark (gratuito) suporta hosting; o Blaze (pay-as-you-go) é necessário para deploy de Cloud Functions.
- **Deploy de produção não é executado nesta task.** O passo de deploy real exige confirmação explícita do usuário e verificação de que o banco Firestore está criado e as Security Rules estão deployadas (TASK-08).

---

## 10. Notas para tarefas relacionadas

- **TASK-09** já configurou `firebase.json` com `"functions": { "source": "functions" }`. Esta task apenas adiciona o bloco `"hosting"` ao mesmo arquivo, sem conflito.
- **TASK-08** deployou `firestore.rules` via `deploy:rules`. O script desta task inclui esse alvo para conveniência.
- **TASK-11** (app shell) é o consumidor principal do hosting: as rotas `(app)/home`, `(auth)/login`, etc. são as páginas que serão servidas pelo CDN.
- Após esta task, o pipeline completo de deploy manual está disponível: `npm run build:hosting && npm run deploy:all`.
