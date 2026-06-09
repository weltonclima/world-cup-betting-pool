# SPEC

## 1. Task id and title
- Task: TASK-01
- Title: Logo no Header (pós-login)

## 2. Objective
Substituir o texto `"Bolão dos Parças"` no `Header` pelo logotipo (`next/image`), clicável → `/home`. Mudança propaga para todas rotas autenticadas via `AppShell`.

## 3. In scope
- Trocar `<span className="text-lg font-bold text-foreground">Bolão dos Parças</span>` por `<Link href="/home">` envolvendo `<Image>`.
- Asset: `public/logo-login.png` (560×373).
- Altura visual `h-8` (32px), `w-auto`, `object-contain` — sem distorção.
- `aria-label="Bolão dos Parças — página inicial"` no Link.
- `alt="Bolão dos Parças"` no Image.
- Preservar layout flex existente: logo esquerda, ações (sino + admin) direita.
- Ajustar `Header.test.tsx`: mock `next/image`, asserção do link do logo.

## 4. Out of scope
- Alterar `AuthLogo.tsx` ou telas `(auth)/*`.
- Criar novo arquivo de logo / novo componente `Logo` separado.
- Alterar `AppShell`, `(app)/layout.tsx`, navegação.
- Dark mode / variação de tema do logo.

## 5. Main technical areas involved
- `src/components/layout/Header.tsx` — produção
- `src/components/layout/__tests__/Header.test.tsx` — teste
- `src/components/auth/AuthLogo.tsx` — referência de padrão (não modificar)
- `public/logo-login.png` — asset existente

## 6. Business rules and behavior
- Logo sempre visível no header em todas rotas autenticadas (role-agnostic).
- Clique no logo navega para `/home`.
- Sem condicional de role/status no logo (diferente da entrada admin que permanece role-gated).

## 7. Contracts and interfaces
N/A — componente visual puro. Sem DTO/endpoint/evento.

`next/image` props:
- `src="/logo-login.png"`, `width={560}`, `height={373}` (intrínsecos, evita CLS)
- `priority` (header always-visible, evita LCP penalty)
- `className` com `h-8 w-auto object-contain`

## 8. Data and persistence impact
Nenhum.

## 9. Required tests
- Teste existente "Painel admin" role-gated continua passando.
- Mock `next/image` em jsdom (ver `AuthLogo.test.tsx` como referência).
- Novo: link do logo presente, `href="/home"`, acessível por `aria-label`.

## 10. Acceptance criteria
- Header renderiza `<Image>` do logo em vez do texto.
- Logo envolto em link para `/home`.
- Layout mantém logo-esquerda / ações-direita em mobile e desktop.
- Sem distorção do logo (aspect-ratio preservado).
- `lint` + `typecheck` + `test` verdes.
- Acessibilidade: link com nome acessível.

## 11. Constraints
- Tailwind only (sem inline styles).
- `next/image` (não `<img>` cru) — padrão do projeto.
- Comentários/domínio em pt-BR.
- TypeScript strict (sem `any`).
- Import alias `@/*`.

## 12. Execution cost profile
- tdd: N/A
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: true
- reason: Modifica componente UI `Header` (layout, imagem, navegação).

## 14. Open questions
Nenhuma — defaults travados no plano (asset, tamanho, link).
