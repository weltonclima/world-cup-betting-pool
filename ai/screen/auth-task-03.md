# SCREEN — TASK-03: Primitivos UI de auth (AuthLogo + PasswordInput)

> Contrato visual: `design-system/MASTER.md`. Componentes compartilhados por Login (TASK-07) e Cadastro (TASK-08). Não são telas — são primitivos reutilizáveis.

## Componente 1 — `AuthLogo`

**Arquivo:** `src/components/auth/AuthLogo.tsx`

**Props:**
```ts
interface AuthLogoProps {
  variant: "login" | "cadastro";
  className?: string;
}
```

**Comportamento / visual:**
- `variant="login"` → `next/image` src `/logo-login.png` (troféu dourado).
- `variant="cadastro"` → `/logo-cadastro.png` (troféu verde).
- `alt="Bolão dos Parças"`.
- Dimensões: largura ~160px, altura proporcional (`width={160} height={160}` com `className="h-auto w-40"`; o PNG é quadrado 768×1024 recortado → usar `object-contain`). Centralizado (`mx-auto`).
- `priority` (logo é above-the-fold).
- Sem fundo próprio — transparente sobre o surface da tela.

**Acessibilidade:** `alt` textual; é imagem informativa (nome do produto), não decorativa.

## Componente 2 — `PasswordInput`

**Arquivo:** `src/components/auth/PasswordInput.tsx`

**Base:** Shadcn `Input` (`@/components/ui/input`) + botão toggle `ghost`.

**Contrato:**
- `forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>` — funciona com `react-hook-form` `register` e com Shadcn `Form`/`FormControl`.
- Encaminha todas as props nativas (`...props`) ao `Input`.
- Estado interno `visible: boolean` → alterna `type` entre `"password"` e `"text"`.
- Botão à direita, sobreposto: wrapper `relative`; botão `absolute right-1 top-1/2 -translate-y-1/2`, `variant="ghost"` `size="icon"` `h-8 w-8`.
- Ícones Lucide `Eye` (mostrar) / `EyeOff` (ocultar), `size={18}`, `aria-hidden`.
- `type="button"` no toggle (não submete o form).
- Input com `pr-10` para não sobrepor texto ao botão.

**Acessibilidade (enhanced):**
- Botão toggle: `aria-label` dinâmico — `"Mostrar senha"` / `"Ocultar senha"`.
- `aria-pressed={visible}`.
- Foco visível padrão (ring do tema); toggle alcançável por teclado.
- Não rouba foco do input ao alternar.

**Tokens/classes:** somente Tailwind do tema (sem hex, sem inline style). Herda `border-input`, `bg-background`, `text-foreground` do `Input`.

## Notas
- Não recriar primitivas que o Shadcn já fornece — `PasswordInput` é uma composição sobre `Input`, justificada (Shadcn não traz toggle).
- Teste leve no `/test`: toggle alterna `type` e `aria-label`.
