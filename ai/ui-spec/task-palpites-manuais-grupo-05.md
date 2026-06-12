# UI-SPEC — TASK-05 · Badge "lançado pelo admin"

> Reusa decisões da TASK-04 (`design-system/MASTER.md` + `patterns/nextjs`). **ui-ux-pro-max não invocado** — badge trivial, padrão já fixado por `PredictionStatusBadge`.

## 1. Objetivo visual
Marcador discreto no card de palpite indicando origem manual (admin), sem competir com o badge de status. Reforça transparência.

## 2. Posição
Dentro de `PredictionListCard`, na linha do divider inferior (junto a "Meu palpite" + status), OU logo abaixo da data. Decisão: inserir na linha do rodapé, à esquerda do `PredictionStatusBadge`, quando presente — fica visualmente associado ao palpite. Em telas estreitas, `flex-wrap` evita overflow.

## 3. Estilo (espelha PredictionStatusBadge)
- Wrapper: `inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium`.
- Cor: tokens neutros/secundários — `bg-muted text-muted-foreground` (discreto; status badge mantém destaque colorido).
- Ícone: `ShieldCheck` lucide `size={12}` `aria-hidden="true"`.
- Texto visível: "Lançado pelo admin".

## 4. Acessibilidade
- Texto visível (não só ícone) — leitor de tela lê naturalmente.
- Ícone `aria-hidden`.
- Contraste garantido por `text-muted-foreground` sobre `bg-muted` (token-safe).
- Opcional `title="Lançado pelo admin"` no wrapper (hint hover, não obrigatório p/ a11y já que texto é visível).

## 5. Estados
| Condição | Visual |
|---|---|
| `item.isManual === true` | badge renderizado |
| `item.isManual === false` | nada (sem espaço reservado) |

## 6. Responsividade
- Rodapé do card vira `flex-wrap` para acomodar badge + "Meu palpite" + status sem overflow no mobile.

## 7. Tokens
- `bg-muted`, `text-muted-foreground`, `rounded-sm`. Sem hex. Sem animação.
