# SPEC — TASK-05: Inicializar Firebase (client + admin SDK)

> Entrada: `ai/plan/feature.md` (TASK-05) + `ai/prd/feature.md` (riscos R2/R5, análise de impacto) + `.claude/CLAUDE.md` (stack Firebase, coleções, controle de acesso).
> Tipo: `integration` · Criticidade: `critical` · Risco técnico: `medium` · Story points: 3.
> TDD: não · Screen: não · Dependências: **TASK-01** (scaffold) — Wave 2.

---

## 1. Objetivo

Inicializar o **Firebase** no projeto, cobrindo as duas faces do SDK:

- **Client SDK** (`firebase`) — roda no **browser**, lê apenas variáveis públicas `NEXT_PUBLIC_FIREBASE_*`. Expõe instâncias de `app`, `auth` e `firestore` para o frontend.
- **Admin SDK** (`firebase-admin`) — roda **somente no servidor** (Server Components, Route Handlers, Cloud Functions). Lê um **service account** server-side. **Jamais** alcança o browser.

A task também materializa a **configuração de projeto Firebase** (`firebase.json`, `.firebaserc`, `firestore.rules` placeholder, `firestore.indexes.json`) e a **Firebase Local Emulator Suite**, de modo que **qualquer dev consiga rodar e o build seja verificável sem credenciais reais** — usando emuladores. A criação do projeto real no Firebase Console e a geração de chaves/service account são **pré-requisito manual do usuário** (seção 9), não escopo de código.

### Truths que devem ser verdadeiras ao fim
- `firebase` e `firebase-admin` instalados como deps; `firebase-tools` como devDep.
- `src/firebase/client.ts` inicializa `app/auth/firestore` do client SDK, **totalmente tipado, sem `any`**, com env validado via Zod, e padrão singleton (reaproveita app em hot reload via `getApps()`).
- `src/firebase/admin.ts` inicializa o admin SDK com singleton (`getApps()`), **server-only**, lendo service account de variável de ambiente server-side; nunca importável pelo browser.
- Conexão automática aos **emuladores** quando a flag de ambiente estiver ligada (`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`).
- `firebase.json` com config de Firestore, Functions, Hosting e portas de emulador; `.firebaserc` com project id placeholder.
- `firestore.rules` placeholder (deny-by-default) + `firestore.indexes.json` vazio válido.
- `.env.local.example` atualizado com o schema completo de variáveis (client público + secret server-side), **sem valores reais**.
- `npm run typecheck`, `npm run lint` e `npm run build` **verdes**.
- **Nenhum segredo real commitado** — apenas `.example`.

---

## 2. Escopo

### Dentro do escopo
- Adicionar deps: `firebase`, `firebase-admin`; devDep: `firebase-tools`.
- `src/firebase/env.ts` — validação Zod das envs públicas (client) e helper para envs server.
- `src/firebase/client.ts` — init do client SDK (singleton + conexão a emuladores condicional).
- `src/firebase/admin.ts` — init do admin SDK (singleton + `server-only`, conexão a emuladores condicional).
- `src/firebase/index.ts` — reexportar **apenas** o client (admin nunca é reexportado pelo barrel para não vazar ao browser).
- Config de projeto: `firebase.json`, `.firebaserc`, `firestore.rules` (placeholder), `firestore.indexes.json`.
- Atualizar `.env.local.example` com o schema completo.
- Garantir `.gitignore` cobre artefatos do emulador/service account (já cobre `.env*`; adicionar entradas extras se necessário).
- Scripts npm de conveniência para emuladores (`emulators`).

### Fora do escopo (tarefas posteriores)
- **Regras Firestore reais** (status/role) e seus testes → **TASK-08**. Aqui só placeholder deny-all.
- **Pasta `functions/`** e código de Cloud Functions / API-Football → **TASK-09**. (Em `firebase.json` deixamos a chave `functions` comentável/mínima ou apontando para `functions` a ser criada na TASK-09 — ver 4.3.)
- **API-Football** — não pertence a esta task (é TASK-09).
- Providers (`QueryProvider`, `AuthProvider`) e `useAuth` → **TASK-06**.
- Schemas Zod das 9 coleções → **TASK-07**.
- Config completa de Hosting/SSR + deploy real → **TASK-10** (aqui só o esqueleto de `firebase.json`).
- Provisionamento do projeto real no Console / emissão de chaves → **pré-requisito do usuário** (seção 9).

> Não criar lógica de domínio, telas, nem tocar em `src/app/*` ou configs de Tailwind/ESLint além do necessário.

---

## 3. Dependências npm a adicionar

Versões alinhadas ao ecossistema atual (junho/2026). Pinar (sem `^`) conforme convenção do projeto para libs críticas.

```bash
npm install firebase@12.14.0 firebase-admin@13.10.0
npm install -D firebase-tools@15.19.1
```

| Pacote | Tipo | Papel |
|---|---|---|
| `firebase` | dependency | Client SDK (browser): `firebase/app`, `firebase/auth`, `firebase/firestore` |
| `firebase-admin` | dependency | Admin SDK (server-only): credenciais privilegiadas |
| `firebase-tools` | devDependency | CLI: `firebase init`, emuladores, deploy (TASK-10) |

> `server-only` (pacote npm da Vercel) é recomendado para blindar `admin.ts` contra import no client. Se ainda não presente: `npm install server-only`. Alternativa sem dep extra na seção 5.2.

---

## 4. Arquivos de configuração

### 4.1 `.firebaserc` (project id placeholder)
O id real é preenchido pelo usuário (seção 9) ou via `firebase use`. Placeholder explícito para o build/emulador não depender de projeto real:

```json
{
  "projects": {
    "default": "bolao-dos-parcas"
  }
}
```

> `bolao-dos-parcas` é um **placeholder**. O usuário troca pelo id real do projeto criado no Console (ou mantém para emulador, que aceita qualquer id via `--project demo-...`).

### 4.2 `firestore.rules` (placeholder deny-by-default)
Regra mínima e **segura por padrão** — nega tudo. As regras reais por `status`/`role` vêm na TASK-08.

```
rules_version = '2';

// PLACEHOLDER — TASK-05. Deny-by-default. Regras reais (status/role) → TASK-08.
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 4.3 `firestore.indexes.json` (vazio válido)
```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

### 4.4 `firebase.json` (Firestore + emuladores; Hosting/Functions esqueleto)
Foco desta task: Firestore + Emulator Suite. Hosting e Functions ficam como esqueleto mínimo (detalhados em TASK-09/TASK-10). Portas de emulador fixas e documentadas.

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
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

> **Functions/Hosting:** intencionalmente **omitidos** das chaves `functions`/`hosting` de deploy nesta task — adicioná-los agora apontaria para uma pasta `functions/` inexistente (TASK-09) e quebraria `firebase deploy`. A porta `functions`/`hosting` no bloco `emulators` é apenas reserva de porta; o emulador de functions só sobe quando a pasta existir (TASK-09). Mantemos o arquivo válido e mínimo. TASK-09 adiciona `"functions"`, TASK-10 adiciona `"hosting"` com rewrites SSR.

### 4.5 `.gitignore` — entradas adicionais
`.env*` já está ignorado (com exceção do `.example`). Adicionar artefatos de emulador/credenciais:

```
# Firebase
/.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
*-debug.log
/emulator-data/
serviceAccountKey.json
```

> O service account **nunca** é commitado. Em dev local usa-se emulador (sem credencial) ou um arquivo local ignorado; em produção, variável de ambiente do host (seção 9).

---

## 5. Código

Restrições do projeto (`.claude/CLAUDE.md`): TS strict, **sem `any`**, sem hardcode de segredos. Validação de env via **Zod** (lib já instalada — `zod@4.4.3`).

### 5.1 `src/firebase/env.ts` — validação de ambiente

Centraliza e valida as envs **públicas** (client) com Zod. Falha cedo e com mensagem clara se faltar variável. Apenas `NEXT_PUBLIC_*` aqui (essas são as únicas que o bundle client pode ver).

```ts
import { z } from "zod";

/**
 * Schema das variáveis públicas do Firebase (client SDK).
 * Todas são NEXT_PUBLIC_* → embarcadas no bundle do browser (NÃO são segredos).
 * Segredos server-side (service account) são lidos em admin.ts, nunca aqui.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  // Flag opcional: liga conexão aos emuladores locais.
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
});

export type FirebaseClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Lê e valida as envs públicas. As referências precisam ser literais
 * (process.env.NEXT_PUBLIC_X) para o Next inlinear no bundle client.
 */
function readClientEnv(): FirebaseClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_USE_EMULATORS:
      process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    throw new Error(
      `Variáveis NEXT_PUBLIC_FIREBASE_* inválidas/ausentes: ${missing}. ` +
        `Copie .env.local.example para .env.local e preencha (ou use emuladores).`,
    );
  }
  return parsed.data;
}

export const firebaseClientEnv = readClientEnv();

export const useEmulators =
  firebaseClientEnv.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";
```

> **Nota sobre validação no client:** com `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`, as chaves reais podem ser valores fictícios (o emulador não as valida). Para permitir build/dev sem projeto real, o `.env.local.example` traz valores demo (seção 6) que satisfazem `min(1)`. Assim o schema passa tanto com credenciais reais quanto em modo emulador.

### 5.2 `src/firebase/client.ts` — client SDK (browser)

Singleton via `getApps()` (evita re-init em hot reload / múltiplos imports). Conecta a emuladores quando `useEmulators`.

```ts
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

import { firebaseClientEnv, useEmulators } from "./env";

const firebaseConfig = {
  apiKey: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

// Singleton: reaproveita o app já criado (hot reload / múltiplos imports).
const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const firebaseAuth: Auth = getAuth(firebaseApp);
const firestore: Firestore = getFirestore(firebaseApp);

// Conecta aos emuladores apenas quando a flag estiver ligada.
// Guard global evita reconectar em hot reload (lança erro se reconectado).
declare global {
  // eslint-disable-next-line no-var
  var __FIREBASE_EMULATORS_CONNECTED__: boolean | undefined;
}

if (useEmulators && !globalThis.__FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  globalThis.__FIREBASE_EMULATORS_CONNECTED__ = true;
}

export { firebaseApp, firebaseAuth, firestore };
```

### 5.3 `src/firebase/admin.ts` — admin SDK (server-only)

Singleton via `getApps()`. **Server-only**: primeira linha `import "server-only"` (falha o build se importado no client). Lê service account de env server-side (JSON em `FIREBASE_SERVICE_ACCOUNT_KEY`). Em modo emulador, usa `applicationDefault()`/sem credencial e respeita `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST`.

```ts
import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";

/**
 * Constrói as credenciais do admin SDK.
 * - Modo emulador: sem service account; o admin SDK detecta
 *   FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST e ignora credenciais.
 * - Modo real: lê o service account JSON da env server-side (NUNCA NEXT_PUBLIC_*).
 */
function buildAdminApp(): App {
  if (getApps().length) {
    return getApp();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (useEmulators) {
    // Emulador: projectId basta; credencial é dispensada.
    return initializeApp({ projectId: projectId ?? "demo-bolao-dos-parcas" });
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY ausente. Defina o service account JSON " +
        "(server-side) ou ligue NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true.",
    );
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido do service account.",
    );
  }

  return initializeApp({ credential: cert(serviceAccount) });
}

const adminApp: App = buildAdminApp();
const adminAuth: Auth = getAuth(adminApp);
const adminFirestore: Firestore = getFirestore(adminApp);

export { adminApp, adminAuth, adminFirestore };
```

> **Conexão do admin ao emulador** não usa `connect*Emulator` (isso é só do client SDK). O admin SDK lê as **env vars** `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` e `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Essas são setadas automaticamente quando o processo Next roda sob `firebase emulators:exec`, ou manualmente no `.env.local` em dev (seção 6).

> **Alternativa sem `server-only`:** se preferir não adicionar a dep, prefixar o arquivo com checagem `if (typeof window !== "undefined") throw new Error(...)` no topo. `server-only` é mais robusto (erro em build-time). Recomendado: usar `server-only`.

### 5.4 `src/firebase/index.ts` — barrel (apenas client)

```ts
// Barrel de firebase. Reexporta APENAS o client SDK (browser-safe).
// admin.ts é server-only e NÃO é reexportado aqui para não vazar ao browser.
// Importe o admin diretamente: `import { adminFirestore } from "@/firebase/admin"`.
export { firebaseApp, firebaseAuth, firestore } from "./client";
```

> **Por que não reexportar admin no barrel:** qualquer import client de `@/firebase` que arrastasse `admin.ts` quebraria o build (`server-only`) ou vazaria credenciais. Admin é sempre importado por caminho explícito server-side.

---

## 6. `.env.local.example` — schema de variáveis

Substituir o conteúdo atual placeholder pelo schema completo. **Valores demo** (não reais) permitem build + emulador sem projeto provisionado.

```bash
# ============================================================
# Firebase — Bolão dos Parças (TASK-05)
# Copie para .env.local e preencha. NÃO commitar .env.local real.
# ============================================================

# --- CLIENT SDK (público — embarcado no bundle do browser, NÃO são segredos) ---
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-bolao-dos-parcas.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-bolao-dos-parcas
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-bolao-dos-parcas.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000

# Liga a conexão aos emuladores locais (true em dev sem projeto real).
NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true

# --- ADMIN SDK (SERVER-ONLY — SEGREDO, nunca prefixar com NEXT_PUBLIC_) ---
# Service account JSON em UMA linha (string JSON completa). Em produção,
# configure via secret do host (Vercel/Functions), nunca em arquivo commitado.
# Em modo emulador pode ficar VAZIO.
FIREBASE_SERVICE_ACCOUNT_KEY=

# --- ADMIN SDK ↔ EMULADOR (setadas automaticamente sob emulators:exec) ---
# Em dev manual, descomente para o admin SDK falar com o emulador:
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

| Variável | Lado | Segredo? | Origem |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client | não | Console → Project settings → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client | não | idem |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client | não | idem |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | client | não | idem |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | client | não | idem |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client | não | idem |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATORS` | client | não | flag local (`true`/`false`) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **server** | **SIM** | Console → Service accounts → Generate key (JSON) |
| `FIRESTORE_EMULATOR_HOST` | server | não | auto sob `emulators:exec` / manual em dev |
| `FIREBASE_AUTH_EMULATOR_HOST` | server | não | idem |

---

## 7. Scripts npm (conveniência)

Adicionar a `package.json`:

```json
{
  "scripts": {
    "emulators": "firebase emulators:start --only auth,firestore --project demo-bolao-dos-parcas",
    "emulators:exec": "firebase emulators:exec --only auth,firestore --project demo-bolao-dos-parcas"
  }
}
```

> Usa `--project demo-bolao-dos-parcas` (id demo) para o emulador rodar **sem projeto real**. O Firebase aceita ids `demo-*` em modo offline.

---

## 8. Passo a passo de implementação

1. **Instalar deps** (seção 3): `firebase`, `firebase-admin`, `firebase-tools` (dev), `server-only`.
2. **Criar config files** (seção 4): `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`. Atualizar `.gitignore`.
   - Opcional: rodar `npx firebase init` para gerar os arquivos interativamente — mas, dado que o conteúdo já está especificado e o ambiente é não-interativo, **criar os arquivos diretamente** com o conteúdo da seção 4 é mais previsível.
3. **Criar código** (seção 5): `src/firebase/env.ts`, `client.ts`, `admin.ts`; atualizar barrel `src/firebase/index.ts`.
4. **Atualizar `.env.local.example`** (seção 6) e criar `.env.local` local (a partir do example) para que `build`/`dev` validem as envs em modo emulador.
5. **Adicionar scripts** npm (seção 7).
6. **Verificar** com a sequência da seção 10 e reportar saída real.

> **Ordem de import:** garantir que nenhum módulo client (ou `src/app/*`) importe `admin.ts`. Validado pelo `server-only` (build quebra se violado).

---

## 9. Pré-requisitos manuais do usuário (fora do código)

Estes passos **o usuário executa** — não são automatizáveis pela implementação e **não bloqueiam** o build (que roda via emulador). Documentados aqui como entrega da task:

1. **Criar o projeto** no [Firebase Console](https://console.firebase.google.com) (id real, ex.: `bolao-dos-parcas-prod`).
2. **Registrar um Web App** no projeto → copiar o `firebaseConfig` → preencher as `NEXT_PUBLIC_FIREBASE_*` no `.env.local` (e nas envs do host em produção).
3. **Habilitar Authentication** → provedor **Email/Senha**.
4. **Criar o Firestore** (modo produção; as regras reais vêm na TASK-08).
5. **Gerar service account:** Console → Project settings → Service accounts → *Generate new private key* → JSON. Colar o JSON (uma linha) em `FIREBASE_SERVICE_ACCOUNT_KEY` **somente** como secret server-side (Vercel/host) — **nunca** commitar.
6. **Apontar `.firebaserc`** para o id real (`firebase use <project-id>`), se for usar deploy/emulador com projeto real.

> Até o usuário concluir isso, o projeto roda **100% em emulador** (`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`), e `tsc`/`lint`/`build` ficam verdes sem credenciais reais. Mitiga **R5** (vazamento de segredo) por construção: nenhum segredo no repo, separação client/server explícita.

---

## 10. Critérios de aceite e verificação

Rodar, nesta ordem, e exigir saída limpa:

```bash
npm run typecheck    # tsc --noEmit → 0 erros (client.ts/admin.ts/env.ts tipados, sem any)
npm run lint         # next lint → 0 erros/warnings
npm run build        # next build → sucesso (envs demo do .env.local satisfazem o Zod)
npx firebase emulators:start --only auth,firestore --project demo-bolao-dos-parcas
# ↑ sobe Auth (9099) + Firestore (8080) + UI (4000) sem projeto real; encerrar com Ctrl+C
```

Checklist:
- [ ] `firebase@12`, `firebase-admin@13` em deps; `firebase-tools@15` em devDeps; `server-only` presente.
- [ ] `src/firebase/client.ts` exporta `firebaseApp/firebaseAuth/firestore`, singleton via `getApps()`, sem `any`.
- [ ] `src/firebase/admin.ts` inicia admin SDK com `import "server-only"`, singleton, lê service account de env server-side, sem `any`.
- [ ] Conexão a emuladores acontece **somente** com `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` (client) / `*_EMULATOR_HOST` (admin).
- [ ] Barrel `src/firebase/index.ts` reexporta **apenas** o client (admin não vazado).
- [ ] `firebase.json` válido com portas de emulador; `.firebaserc` com placeholder; `firestore.rules` deny-all; `firestore.indexes.json` válido.
- [ ] `.env.local.example` lista client público + secret server-side separados, **sem valores reais**.
- [ ] Nenhum segredo real commitado; `.gitignore` cobre artefatos de emulador/service account.
- [ ] `typecheck`, `lint`, `build` verdes; emulador sobe sem projeto real.

---

## 11. Riscos e mitigações (desta tarefa)

| # | Risco | Mitigação |
|---|---|---|
| T1 | Service account vazar para o browser (PRD R5) | `admin.ts` com `import "server-only"`; barrel não reexporta admin; secret nunca prefixado com `NEXT_PUBLIC_`; `.gitignore` cobre JSON e `.env*` |
| T2 | Re-init do SDK em hot reload (`already exists`) | Singleton via `getApps()` no client e no admin; guard global para `connect*Emulator` |
| T3 | Build/dev exigir projeto real | Modo emulador + valores demo no `.env.local.example` → build verde sem credenciais |
| T4 | `firebase.json` apontar para `functions/` inexistente e quebrar deploy | Omitir chaves `functions`/`hosting` de deploy nesta task; adicionadas em TASK-09/TASK-10 |
| T5 | `connect*Emulator` chamado 2x lança erro | Guard `globalThis.__FIREBASE_EMULATORS_CONNECTED__` |
| T6 | Env ausente derrubar runtime sem mensagem clara | Validação Zod em `env.ts` com erro descritivo (qual variável faltou) |
| T7 | Admin SDK tentar credencial real em modo emulador | Branch explícito `useEmulators` em `buildAdminApp()` (sem `cert`) |

---

## 12. Notas para as próximas tarefas
- **TASK-06** consome `firebaseAuth`/`firestore` de `@/firebase` para `AuthProvider` + `useAuth` (perfil/status do Firestore).
- **TASK-07** define schemas Zod das 9 coleções; `admin.ts`/`client.ts` passam a tipar `Firestore` com converters derivados desses schemas.
- **TASK-08** substitui o `firestore.rules` placeholder pelas regras reais (status/role) + testes via `@firebase/rules-unit-testing` sobre o emulador já configurado aqui.
- **TASK-09** cria a pasta `functions/` e adiciona a chave `"functions"` em `firebase.json`; reusa `FIREBASE_SERVICE_ACCOUNT_KEY` e o emulador de functions (porta 5001 já reservada).
- **TASK-10** adiciona `"hosting"` com rewrites SSR (Next 15) ao `firebase.json` e o fluxo de deploy.
