# REVIEW ADVERSARIAL — TASK-07a (remoção de `output:"export"`)

> Commit: `2c438e1` · Plano: `ai/plan/integracao-api-football.md` (TASK-07, item infra) · Spec dedicada: **não existe** (avaliado contra o plano)
> Stance: adversarial / FORCE · Modo: standard · READ-ONLY (nenhum arquivo de implementação alterado)

## Escopo revisado

- `next.config.ts` (única alteração do commit: `+3 / -5`)
- Cross-check: `firebase.json`, `middleware.ts`, `src/app/api/**/route.ts`

## O que o commit faz

Remove `output: "export"` (e o comentário sobre `cleanUrls`/static export) do `next.config.ts`, substituindo por comentário que documenta a migração para runtime SSR (App Hosting/Cloud Run) e adia a config completa (`apphosting.yaml` + secret) para a TASK-07b. Mantém `trailingSlash: false` e `images.unoptimized: true`.

## Verificações

### A remoção quebra algo? — NÃO. É necessária e correta.
Confirmado que já existem artefatos que **exigem** runtime de servidor e seriam silenciosamente quebrados por `output:"export"`:
- `middleware.ts` (existe)
- `src/app/api/{matches,matches/[id],teams,standings,auth/session}/route.ts` (5 Route Handlers existem)

Com `output:"export"`, Route Handlers e Middleware **não são suportados** no build estático. Portanto a remoção não só não quebra nada — **destrava** a arquitetura PRD-07 v2.0. Manter `output:"export"` é que seria o defeito.

### `next/image unoptimized` ainda coerente? — Coerente, com nuance (WARNING leve / observação T07b).
Em static export `unoptimized:true` era **obrigatório** (sem servidor de otimização). Em SSR no Cloud Run o otimizador de imagem do Next passa a existir, então `unoptimized:true` deixa de ser obrigatório — mas **continua válido e seguro** (apenas abre mão da otimização server-side). O comentário acima da flag ainda fala em "static export", ficando levemente desatualizado. Decisão de manter/remover pertence à TASK-07b (revisão de `next/image` está no escopo de T07). Não é defeito desta tarefa.

### `firebase.json` ainda aponta `hosting.public:"out"` — INCONSISTÊNCIA real, porém pendente p/ T07b.
`firebase.json` ainda contém o bloco `hosting` com `public:"out"`, `cleanUrls:true` e headers de `**/*.html`. Com `output:"export"` removido, o diretório `out/` **não será mais gerado** por `next build`. Logo um `firebase deploy --only hosting` hoje publicaria conteúdo obsoleto/inexistente.

Classificação: **WARNING**, não BLOCKER. Justificativa:
1. O commit é explicitamente parcial — a mensagem e o comentário no `next.config.ts` declaram que `apphosting.yaml` + secret + deploy ficam na **TASK-07b**. O autor sinalizou o débito.
2. Não há quebra em desenvolvimento: Route Handlers e Middleware já rodam em `next dev` independentemente do hosting (conforme nota do plano em T07).
3. Não há perda de dados nem risco de segurança; é um estado intermediário de uma migração faseada (T07a→T07b) deliberada.
4. Vira BLOCKER **apenas** se alguém tentar `firebase deploy --only hosting` antes da T07b — o que a documentação do próprio commit desencoraja.

## Achados

| ID | Sev | Achado |
|---|---|---|
| W-01 | WARNING | `firebase.json` ainda usa `hosting.public:"out"`; `out/` não é mais gerado pós-remoção do static export. Deploy de hosting publicaria conteúdo obsoleto. Pendente/explícito para T07b. |
| W-02 | WARNING | Comentário sobre `next/image unoptimized` ainda referencia "static export"; em SSR a flag deixa de ser obrigatória (apenas válida). Revisar em T07b. |

Nenhum BLOCKER.

## Verdict

**APROVADO (com débito rastreado para T07b).** A alteração é mínima, correta e pré-condição necessária para Route Handlers/Middleware. As duas inconsistências (firebase.json `out`, comentário de imagem) são WARNINGs faseados, explicitamente delegados à TASK-07b pela própria mensagem do commit, sem risco em dev nem de dados.

---
_Reviewer: Claude (review adversarial)_ · _Modo: standard_
