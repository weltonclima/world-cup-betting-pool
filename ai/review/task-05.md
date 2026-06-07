# Revisão de Código — TASK-05: Inicializar Firebase (client + admin SDK)

**Revisado em:** 2026-06-05  
**Profundidade:** deep (cross-file + foco de segurança)  
**Arquivos revisados:** `src/firebase/env.ts`, `src/firebase/client.ts`, `src/firebase/admin.ts`, `src/firebase/index.ts`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `.env.local.example`, `.gitignore`, `package.json`  
**Veredicto:** `aprovado com ajustes`

---

## Resumo

A implementação cobre corretamente os itens centrais de segurança da TASK-05:

- `import "server-only"` é a primeira linha de `admin.ts` — garantia de build-time contra import no client.
- `FIREBASE_SERVICE_ACCOUNT_KEY` **não tem** prefixo `NEXT_PUBLIC_` — segredo nunca embarcado no bundle.
- O barrel `src/firebase/index.ts` reexporta **apenas** o client SDK; admin nunca é exposto via `@/firebase`.
- Singleton via `getApps()` implementado em ambos os SDKs.
- Guard `globalThis.__FIREBASE_EMULATORS_CONNECTED__` previne double-connect em hot reload.
- `.gitignore` cobre `.env*`, `serviceAccountKey.json` e artefatos do emulador.
- `tsc --noEmit` passa sem erros. `next lint --dir src` passa sem erros.

Não foram encontrados segredos reais commitados. Os três findings abaixo são de escopo e qualidade — nenhum é uma vulnerabilidade de segurança em runtime.

---

## Achados Críticos (BLOCKER)

Nenhum.

---

## Avisos (WARNING)

### WR-01: `firebase.json` contém chaves `functions` e `hosting` além do escopo da TASK-05

**Arquivo:** `firebase.json:6-50`  
**Issue:** A spec (seções 4.4 e 4.3) é explícita: as chaves `"functions"` e `"hosting"` de **deploy** devem ser **omitidas** nesta task e adicionadas nas TASK-09 e TASK-10 respectivamente. O motivo documentado: adicionar `"functions"` agora aponta para a pasta `functions/` antes desta estar integrada ao projeto raiz, e `"hosting"` com `"public": "out"` configura Hosting em modo estático (`next export`), incompatível com SSR (App Router).

O arquivo implementado inclui:
```json
"functions": { "source": "functions" },
"hosting": { "public": "out", "cleanUrls": true, ... }
```

Consequência imediata: `firebase deploy` a partir do raiz tentará fazer deploy de Functions e Hosting com configuração incompleta/errada. O bloco `"hosting"` com `"public": "out"` é especialmente problemático — Next.js 15 com App Router **não suporta** `next export` (pasta `out/`); o deploy de Hosting produziria um site quebrado.

**Fix:** Reduzir `firebase.json` ao mínimo definido na spec:
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
As chaves `"functions"` e `"hosting"` de deploy são adicionadas nas TASK-09/10.

---

### WR-02: `firestore.rules` contém regras completas de produção (TASK-08), não o placeholder deny-all

**Arquivo:** `firestore.rules:1-95`  
**Issue:** A spec define explicitamente que o `firestore.rules` desta task deve ser um **placeholder deny-by-default** de 8 linhas:
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

O arquivo entregue contém regras completas com `isAdmin()`, `isApproved()`, controle por `role`/`status`, políticas por coleção (`users`, `predictions`, `bonus_predictions`, etc.) — trabalho pertencente à **TASK-08** e seus testes (`@firebase/rules-unit-testing`).

Ao antecipar essas regras sem os testes da TASK-08, cria-se risco de regressão: se a TASK-08 alterar as regras para cobrir edge cases identificados nos testes unitários, haverá conflito ou sobrescrita silenciosa. O contrato da TASK-08 é ser a **autora** dessas regras, não encontrá-las prontas.

Adicionalmente, o arquivo não contém o comentário `// PLACEHOLDER — TASK-05` esperado, indicando que a mudança de escopo foi intencional.

**Fix:** Substituir o conteúdo pelo placeholder conforme spec. As regras completas entram na TASK-08 junto com seus testes.

---

### WR-03: `firebase-tools` pinado com `^` (range) em vez de versão exata

**Arquivo:** `package.json:67`  
**Issue:** A spec (seção 3) instrui a pinar dependências críticas sem `^` (`firebase-tools@15.19.1`). O `package.json` registra `"firebase-tools": "^13.35.1"` — versão diferente da especificada **e** com caret, violando a convenção de pinagem do projeto.

`firebase-tools` é uma devDependency de CLI, então o risco em produção é baixo. Porém a versão `^13.35.1` é significativamente mais antiga que `15.19.1` especificada, o que pode produzir comportamento diferente dos emuladores (especialmente emulador de Functions, porta 5001).

**Fix:** `"firebase-tools": "15.19.1"` (sem caret).

---

### WR-04: `admin.ts` usa `as ServiceAccount` sem validação de estrutura

**Arquivo:** `src/firebase/admin.ts:44`  
**Issue:** Após o `JSON.parse(raw)` ter sucesso, o resultado é imediatamente convertido com `as ServiceAccount` sem verificar campos obrigatórios (`project_id`, `private_key`, `client_email`). Se o JSON for válido mas incompleto (ex.: usuário colou o JSON errado), o `cert()` receberá um objeto malformado, e o erro será lançado pelo Firebase Admin SDK em runtime (normalmente durante a primeira chamada autenticada), não no momento da inicialização.

```typescript
// linha 44 — atual
serviceAccount = JSON.parse(raw) as ServiceAccount;
```

O erro será opaco: o SDK lança algo como `"Error: Invalid PEM format"` ou `"Error: Failed to parse service account"` no momento de uso, não na inicialização.

**Fix (mínimo):** Validar a presença dos campos obrigatórios antes do `cert()`:
```typescript
const parsed: unknown = JSON.parse(raw);
if (
  typeof parsed !== "object" || parsed === null ||
  !("project_id" in parsed) ||
  !("private_key" in parsed) ||
  !("client_email" in parsed)
) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_KEY: JSON válido, mas campos obrigatórios ausentes " +
    "(project_id, private_key, client_email)."
  );
}
serviceAccount = parsed as ServiceAccount;
```

---

## Achados Informativos (INFO)

### IN-01: `npm run build` falha com erro de tipos pré-existente

**Arquivo:** `src/app/(app)/home/page.tsx` (indiretamente via `.next/types`)  
**Issue:** `next build` falha com:
```
Type error: File 'C:/www/world-cup-betting-pool/.next/types/app/(app)/home/page.ts' not found.
```
Este erro é pré-existente ao TASK-05 (relacionado ao cache `.next/types` e à estrutura de route groups com parênteses no Windows). O critério de aceite da TASK-05 exige `npm run build` verde.

O erro **não é causado** pelo código da TASK-05 — `tsc --noEmit` passa limpo — mas impede a verificação do build de produção, incluindo a confirmação de que o `server-only` do `admin.ts` está sendo aplicado corretamente pelo bundler.

**Fix:** Verificar se o problema está no `tsconfig.json` (`baseUrl` depreciado no TS 7.0, já alertado pelo IDE) ou em um artefato corrompido do `.next/types`. Rodar `rimraf .next && next build` em ambiente limpo para isolar.

---

### IN-02: `tsconfig.json` usa `baseUrl` depreciado (aviso do IDE)

**Arquivo:** `tsconfig.json:21`  
**Issue:** O IDE reporta: `Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`. Embora o projeto esteja em TS 5.9.3, é conveniente endereçar antes da migração.  
**Fix:** Adicionar `"ignoreDeprecations": "6.0"` ao `compilerOptions` ou migrar para a configuração recomendada via `paths` sem `baseUrl`.

---

## Checklist de Segurança (Itens Verificados)

| Critério | Status |
|---|---|
| `import "server-only"` é a primeira linha de `admin.ts` | PASSOU |
| `FIREBASE_SERVICE_ACCOUNT_KEY` sem prefixo `NEXT_PUBLIC_` | PASSOU |
| Barrel `index.ts` não reexporta `admin.ts` | PASSOU |
| Nenhum import de `firebase-admin` fora de `admin.ts` | PASSOU |
| `.gitignore` cobre `.env*` (exceto `.example`) | PASSOU |
| `.gitignore` cobre `serviceAccountKey.json` | PASSOU |
| `.gitignore` cobre `/.firebase/`, `/emulator-data/`, `*-debug.log` | PASSOU |
| `FIREBASE_SERVICE_ACCOUNT_KEY` ausente do `.env.local.example` (valor vazio) | PASSOU |
| Bundle `.next/static` — sem `FIREBASE_SERVICE_ACCOUNT_KEY` / `firebase-admin` | INCONCLUSIVO (build não gerado — IN-01) |
| `client.ts` não acessa `process.env.FIREBASE_SERVICE_ACCOUNT_KEY` | PASSOU |
| Singleton `getApps()` em `client.ts` e `admin.ts` | PASSOU |
| Guard global `__FIREBASE_EMULATORS_CONNECTED__` em `client.ts` | PASSOU |
| Validação Zod de envs públicas com erro descritivo | PASSOU |
| `admin.ts` sem `NEXT_PUBLIC_` prefix em variáveis secretas | PASSOU |
| `tsc --noEmit` | PASSOU (0 erros) |
| `next lint --dir src` | PASSOU (0 erros) |

---

## Ações para o Implementador

1. **WR-01 (obrigatório):** Remover chaves `"functions"` e `"hosting"` de `firebase.json`; manter apenas `"firestore"` e `"emulators"`.
2. **WR-02 (obrigatório):** Substituir `firestore.rules` pelo placeholder deny-all da spec; mover as regras completas para a TASK-08.
3. **WR-03 (recomendado):** Corrigir versão de `firebase-tools` para `15.19.1` sem caret.
4. **WR-04 (recomendado):** Adicionar validação de campos obrigatórios do service account antes do `cert()`.
5. **IN-01 (obrigatório para fechar aceite):** Resolver erro de build pré-existente para confirmar que `next build` passa limpo.

---

_Revisado em: 2026-06-05_  
_Revisor: Staff Engineer — revisão adversarial_  
_Profundidade: deep_
