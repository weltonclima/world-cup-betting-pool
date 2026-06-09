# PRD — Logo no Header (pós-login)

## 1. Feature summary

Substituir o texto `"Bolão dos Parças"` no `Header` pela imagem do logotipo do produto. A mudança se propaga automaticamente para todas as páginas autenticadas, pois o `Header` é renderizado uma única vez pelo `AppShell`.

## 2. Consolidated scope

**Inclui:**
- Trocar o `<span>` de identidade textual no `Header` por um `<Image>` (next/image) do logotipo.
- O logo deve ser um link para `/home` (padrão de identidade visual — clique leva ao início).
- Manter acessibilidade: `alt` descritivo, `aria-label` no link.
- Dimensionar o logo para caber na altura fixa do header (`h-14` = 56 px) com folga visual — alvo ~32 px de altura, largura proporcional (aspect-ratio ≈ 3:2).
- Atualizar os testes existentes do `Header` que referenciam o comportamento do elemento de identidade (se houver asserções sobre o texto).

**Não inclui:**
- Criar novo arquivo de logo (já existem `logo-login.png` e `logo-cadastro.png`).
- Alterar telas de auth (login/cadastro) — `AuthLogo` permanece intacto.
- Novo componente `Logo` separado — pode ser inlined no Header ou extraído como micro-componente dentro do mesmo arquivo; decisão de implementação.

## 3. System understanding relevant to this feature

### Ponto de mudança único
- `src/components/layout/Header.tsx` — `<span className="text-lg font-bold text-foreground">Bolão dos Parças</span>` → substituído por imagem.
- Montado por `AppShell` (`src/components/layout/AppShell.tsx`) que é usado pelo `(app)/layout.tsx` — cobertura total de rotas autenticadas.

### Assets disponíveis
| Arquivo | Dimensões | Uso atual |
|---|---|---|
| `public/logo-login.png` | 560 × 373 px (landscape, troféu dourado) | Tela de login |
| `public/logo-cadastro.png` | 560 × 373 px | Tela de cadastro |

Aspect-ratio: 560/373 ≈ 1.50 (landscape). Para h-8 (32 px) → w ≈ 48 px.

### Padrão de imagem no projeto
`AuthLogo` (`src/components/auth/AuthLogo.tsx`) demonstra o padrão correto: `next/image` com `width`/`height` intrínsecos + `priority` + `h-auto object-contain`.

### Testes existentes
`src/components/layout/__tests__/Header.test.tsx` testa apenas o link "Painel admin" (role-gated). Não há asserção sobre o texto "Bolão dos Parças", então a mudança não quebra testes existentes. Porém, `next/image` precisa de mock em ambiente jsdom — o arquivo de teste já pode não ter isso (verificar).

## 4. Technical impact analysis

| Área | Impacto |
|---|---|
| `Header.tsx` | Modificação direta — troca `<span>` por `<Image>` + `<Link>` |
| `Header.test.tsx` | Possível adição de mock `next/image` e teste de acessibilidade do logo |
| `AppShell.tsx` | Sem alteração |
| `(app)/layout.tsx` | Sem alteração |
| `AuthLogo.tsx` | Sem alteração (não reutilizado — logo header tem contexto diferente) |
| Rotas `(auth)/*` | Sem impacto — usam `AuthGuard`/`AuthLogo` separados |
| Bundle size | Mínimo — `next/image` já importado no projeto via `AuthLogo` |
| Performance | `priority` deve ser omitido no Header (não é above-the-fold crítico por ser fixed/sticky) ou mantido — discutir |

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Logo com dimensões erradas distorce o header em mobile | Baixa | Usar `h-auto` + width fixo ou inverter: height fixo + width auto |
| `next/image` sem mock no teste jsdom → crash | Baixa | Adicionar `vi.mock("next/image")` no teste |
| Logo legível em dark mode (se implementado no futuro) | Baixa | Asset atual é PNG com fundo; não bloqueia agora |
| Regressão de acessibilidade (link sem label) | Baixa | Garantir `aria-label` no `<Link>` |

## 6. Ambiguities and gaps

| Item | Status |
|---|---|
| Qual PNG usar no header? `logo-login.png` ou `logo-cadastro.png`? | Não especificado — ambos têm dimensões idênticas; `logo-login` (troféu dourado) é mais alinhado ao contexto de app autenticado |
| Tamanho visual do logo no header | Não especificado — `h-8` (32 px) é razoável para `h-14` de header; pode precisar de ajuste |
| O logo deve ser clicável (link para home)? | Padrão UX convencional — assumido como sim |
| `priority` na imagem? | Header é fixo/always-visible; `priority` evita LCP penalty mas aumenta prefetch; razoável manter |

## 7. Recommended implementation concerns

- Modificação é cirúrgica: 1 componente, ~5 linhas de diferença.
- Extrair logo como `<Link href="/home">` wrapping `<Image>` inline no Header é suficiente — não precisa de novo componente separado.
- Manter `aria-label="Página inicial"` no Link para acessibilidade.
- Dimensionar com `height` fixo em `className` e `width`/`height` intrínsecos passados ao `next/image` para evitar CLS.
- Verificar se o teste do Header precisa de mock `next/image` (provavelmente sim — `AuthLogo.test.tsx` pode servir de referência).
