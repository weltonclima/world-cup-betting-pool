# Relatório de Validação Local — Bolão dos Parças

**Data:** 2026-06-05  
**Projeto:** world-cup-betting-pool  
**Stack:** Next.js 15 + React 19 + TypeScript + Tailwind v4 + Shadcn + Firebase  

---

## Tabela de Resultados

| # | Etapa | Comando | Resultado | Detalhes |
|---|-------|---------|-----------|---------|
| 1 | TypeScript (raiz) | `npx tsc --noEmit` | PASSOU | Sem erros de tipo |
| 2 | Lint (raiz) | `npm run lint` | PASSOU | Nenhum aviso ou erro ESLint |
| 3 | Testes unitários (raiz) | `npm test` | PASSOU | 106/106 testes — 13 arquivos |
| 4 | Regras Firestore | `npm run test:rules` | PASSOU | 25/25 testes — emulador Firestore |
| 5a | Testes functions | `cd functions && npm test` | PASSOU | 44/44 testes — 4 arquivos |
| 5b | Build functions | `cd functions && npm run build` | PASSOU | Compilação TypeScript sem erros |
| 6 | Build estático (hosting) | `npm run build:hosting` | PASSOU | 9 rotas estáticas exportadas em out/ |
| 7 | Boot servidor dev | `npm run dev` | PASSOU | Pronto em 7.2s; / e /login retornaram HTTP 200 |

---

## Contagem de Testes

| Suite | Arquivos | Testes | Status |
|-------|----------|--------|--------|
| Unitários (raiz — vitest) | 13 | 106 | OK |
| Regras Firestore (emulador) | 1 | 25 | OK |
| Functions (vitest) | 4 | 44 | OK |
| TOTAL | 18 | 175 | OK |

---

## Arquivos HTML Gerados em out/

- out/index.html
- out/home.html
- out/login.html
- out/matches.html
- out/pending.html
- out/predictions.html
- out/profile.html
- out/rankings.html
- out/404.html

Total: 9 arquivos HTML (incluindo 404).

---

## Resultado do Boot do Servidor Dev

- Porta usada: 3001 (porta 3000 estava ocupada pelo processo 51432)
- Tempo até Ready: 7.2 segundos
- GET / (raiz): HTTP 200 — HTML válido com lang="pt-BR"
- GET /login: HTTP 200 — HTML válido
- Erros de console: Nenhum durante boot
- Erros de Firestore: ESPERADOS — sem chamadas Firestore no boot; produção requer DB criado manualmente

---

## Pré-requisitos Manuais Pendentes (Produção)

1. Criar banco Firestore no Firebase Console (world-cup-betting-pool-8e93c → Firestore Database → Create database)
2. Habilitar provedor Email/Senha no Firebase Auth (Authentication → Sign-in method → Email/Password)
3. Publicar regras Firestore: firebase deploy --only firestore:rules
4. Deploy das Cloud Functions: firebase deploy --only functions
5. Deploy de hosting: firebase deploy --only hosting
6. Autenticar Firebase CLI: firebase login (CLI atualmente sem autenticação)
