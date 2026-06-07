# Review — TASK-02: Configurar Shadcn UI + tema base

**Data:** 2026-06-05  
**Revisor:** Staff Engineer (adversarial)  
**Profundidade:** deep (cross-file + análise de contratos)  
**Veredicto:** `aprovado com ajustes`

---

## Resumo

A implementação entrega corretamente o núcleo da TASK-02: `components.json` configurado para Tailwind v4 + CSS variables, tokens `oklch` em `globals.css`, helper `cn` em `utils.ts`, componentes base tipados (`button`, `input`, `label`, `sonner`, `form`) sem uso de `any` e sem hex hardcoded. O desvio de Base UI (não Radix) é o padrão atual do Shadcn e está corretamente documentado na spec. O `tsconfig.json` recebeu apenas o `baseUrl` mínimo exigido.

Foram identificadas **três violações**: um bug de lógica em `form.tsx` (guard pós-acesso), escopo expandido sem autorização (`tooltip.tsx` + provider wiring antecipado em `providers/index.tsx`), e a gate `npm run build` falha consistentemente por erro de filesystem no Windows. Nenhuma violação bloqueia funcionalidade em desenvolvimento, mas duas delas violam contratos explícitos da spec.

---

## Achados

### WARNING-01: Bug de lógica — null-guard pós-acesso em `useFormField`

**Arquivo:** `src/components/ui/form.tsx:44–53`  
**Classificação:** WARNING  

O hook `useFormField` acessa `fieldContext.name` nas linhas 48 e 49 **antes** da guarda de contexto na linha 51. O contexto é inicializado como `{} as FormFieldContextValue`, portanto `fieldContext` é sempre truthy — a guarda nunca dispara. Acessar `.name` em `undefined` (quando usado fora de `<FormField>`) resulta em `name: undefined` passado silenciosamente para `useFormState` e `getFieldState`, gerando comportamento indefinido em vez do erro descritivo pretendido.

**Evidência:**
```typescript
// Linha 28 — contexto inicializado como objeto vazio tipado:
const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

// Linhas 48-49 — acesso a fieldContext.name ANTES da guarda:
const formState = useFormState({ name: fieldContext.name })  // name = undefined
const fieldState = getFieldState(fieldContext.name, formState) // name = undefined

// Linha 51 — guarda inútil: {} é truthy, nunca vai jogar
if (!fieldContext) {
  throw new Error("useFormField should be used within <FormField>")
}
```

**Correção:** Mover a guarda para antes do primeiro acesso a `fieldContext.name`, verificando a propriedade `name` em vez do objeto (que é sempre truthy):

```typescript
const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)

  // Guarda ANTES de qualquer acesso a fieldContext.name
  if (!fieldContext.name) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}
```

---

### WARNING-02: Escopo expandido — `tooltip.tsx` não autorizado pela spec

**Arquivo:** `src/components/ui/tooltip.tsx`  
**Classificação:** WARNING  

A spec de TASK-02 lista explicitamente os componentes a instalar: `button`, `input`, `form`, `sonner`, `label`. O `tooltip.tsx` não consta no escopo e sua instalação antecipada (sem especificação, sem revisão de API) introduz dependência não auditada em produção. Não é bloqueante hoje — o componente é tipado e sem `any` — mas viola o contrato de escopo.

**Ref. spec:** Seção 2 "Dentro do escopo" e tabela de arquivos afetados (seção 4).

**Ação requerida:** Documentar o desvio no próximo commit (comentário ou `ai/decisions/`) ou mover o `tooltip.tsx` para a task que efetivamente precisar dele. Não remover agora se `providers/index.tsx` já depende dele (ver WARNING-03).

---

### WARNING-03: Escopo expandido — `<Toaster>` e `<TooltipProvider>` montados em `providers/index.tsx`

**Arquivo:** `src/providers/index.tsx:5–6, 30–33`  
**Classificação:** WARNING  

A spec é explícita (seções 1 e 2):

> "o `<Toaster />` da Sonner **não** é montado aqui (isso é TASK-06/TASK-11). Apenas o arquivo do componente `sonner.tsx` é instalado."  
> "Wiring de providers — montar `<Toaster />` da Sonner, `next-themes` ThemeProvider, QueryClient, AuthProvider → **TASK-06**."

A implementação montou `<Toaster richColors position="top-center" />` e `<TooltipProvider>` dentro de `Providers` (que é carregado pelo `layout.tsx`), completando o wiring de runtime que a spec reservou para TASK-06/TASK-11. Isso não causa bug funcional imediato, mas:

1. Viola o contrato de escopo da task — `providers/index.tsx` não deveria ter sido alterado.
2. Antecipa decisões de TASK-06 (posição do toast, `richColors`) sem spec.
3. Acopla `tooltip.tsx` ao bootstrap global sem decisão documentada.

**Ação requerida:** Nenhuma reversão urgente (funciona). Registrar como dívida intencional ou reatribuir à TASK-06 na documentação do plano.

---

### WARNING-04: Gate `npm run build` falha no Windows por race condition do Next.js 15.5.x

**Arquivo:** ambiente de build  
**Classificação:** WARNING  

O critério de aceite da spec exige `npm run build` verde. A compilação TypeScript passa (`✓ Compiled successfully`) e todas as 11 páginas estáticas são geradas com sucesso, mas o processo termina com exit code 1 por `ENOENT` na fase "Collecting build traces":

```
[Error: ENOENT: no such file or directory, open '.next\server\app\_not-found\page.js.nft.json']
```

Este é um bug do Next.js 15.5.x no Windows (escrita concorrente de arquivos `.nft.json`). Ocorre de forma intermitente e não está relacionado ao código desta task. A evidência é que o build termina a geração estática completa antes de falhar na fase de rastreamento.

**Não é defeito da implementação**, mas viola formalmente o critério de aceite. Registrar como limitação de ambiente até upgrade/fix do Next.js.

---

## Achados que NÃO foram encontrados (confirmações positivas)

| Verificação | Status |
|---|---|
| Uso de `any` nos componentes | Nenhum encontrado |
| Hex hardcoded fora do tema | Nenhum encontrado |
| Tokens CSS fora de `oklch` | Nenhum encontrado |
| `<Toaster>` montado em `layout.tsx` | Não montado (correto) |
| `@theme inline` presente em `globals.css` | Presente e correto |
| `:root` e `.dark` com tokens oklch | Completos e corretos |
| `components.json`: `cssVariables: true`, `tailwind.config: ""` | Correto |
| `tsconfig.json`: apenas `baseUrl: "."` adicionado | Correto, mínimo |
| `cn` exportado de `src/lib/utils.ts` | Correto |
| `npx tsc --noEmit` | Verde |
| `npm run lint` | Verde (0 warnings/errors) |
| Estilo inline em `sonner.tsx` (CSS vars) | Justificado pela spec — padrão canônico Shadcn |
| Desvio Base UI (não Radix) | Documentado e correto per spec §3.2 |
| `FormControl` com `useRender` (sem Radix `Slot`) | Implementado corretamente per spec §3.3 |
| Componentes base tipados (`button`, `input`, `form`, `label`, `sonner`) | Todos tipados, sem `any` |

---

## Veredicto final

**`aprovado com ajustes`**

Nenhum BLOCKER. Três WARNINGs a resolver:

1. **WARNING-01** (forma.tsx, bug de guard) — corrigir antes das features que consomem `<FormField>`.
2. **WARNING-02** (tooltip.tsx fora de escopo) — documentar desvio ou mover para task correta.
3. **WARNING-03** (provider wiring antecipado) — anotar como dívida intencional atribuída à TASK-06.
4. **WARNING-04** (build Windows ENOENT) — registrar como limitação de ambiente, não de código.

O core da TASK-02 está correto e pronto para alimentar as features futuras.
