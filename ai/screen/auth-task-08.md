# SCREEN — TASK-08: Tela de Cadastro (revisado p/ cadastro.png)

> Fonte de verdade: `docs/prd-01/cadastro.png`. Contrato: `design-system/MASTER.md`. Sem BottomNav.

## Decisões (confirmadas)
- **Fundo CLARO** de página inteira (sem hero verde — diferente do login). Classe `.auth-light` (globals.css): superfície clara + `--primary` verde p/ CTA e links (AA).
- **Confirmar senha:** MANTER (diverge do mock; reduz erro de digitação).
- **Termos de Uso:** REMOVER (segue o mock — sem checkbox).
- **Política de senha:** manter `min 6` atual (sem checklist ao vivo, sem exigência de número).

## Layout (mobile-first, tela clara)
```
[ .auth-light · min-h-screen · flex col · items-center · bg-background · px-6 · py-10 ]
  └─ <main aria-label="Criar conta"> mx-auto w-full max-w-sm · flex col gap-6
       ├─ AuthLogo variant="cadastro"  (dourado, centralizado)
       ├─ <div text-center>
       │    h1 "Criar sua conta"  text-2xl font-bold text-foreground
       │    p  "Preencha os dados abaixo para criar sua conta."  text-sm text-muted-foreground
       ├─ SignupForm  (campos com ÍCONE à esquerda)
       │    ├─ Nome completo   (ícone User)   placeholder "Digite seu nome completo"
       │    ├─ Apelido         (ícone AtSign) placeholder "Digite seu apelido"
       │    ├─ Email           (ícone Mail)   placeholder "Digite seu melhor email"
       │    ├─ Senha           (ícone Lock + toggle olho) placeholder "Digite sua senha"
       │    ├─ Confirmar senha (ícone Lock + toggle olho) placeholder "Confirme sua senha"
       │    └─ Button "Criar conta"  variant=default (verde) w-full h-11 · disabled até válido
       └─ footer  "Já tem conta? " + <Link href="/login"> "Entrar" (verde)
```
> Sem card elevado — campos direto na superfície clara, como no mock.

## Componentes
**`SignupForm`** (`src/features/auth/SignupForm.tsx`): RHF + `zodResolver(signupFormSchema)`, `mode:onChange`. Remover campo/checkbox `acceptTerms` e o import de `Checkbox`. Submeter `signUp({name,nickname,email,password})`. Erro → `toast.error(mapAuthError(code))`. Inputs de texto recebem ícone à esquerda; senhas usam `PasswordInput` com ícone à esquerda + toggle à direita.

**`PasswordInput`** (`src/components/auth/PasswordInput.tsx`): adicionar prop opcional `leftIcon?: React.ReactNode` (ícone absoluto à esquerda, input com `pl-9`), mantendo o toggle existente à direita e a a11y (44px, aria-label/aria-pressed).

**Inputs de texto com ícone:** compor wrapper `relative` + ícone Lucide `absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground` (size 18, aria-hidden) + `Input` com `pl-9`.

**`schemas.ts`**: remover `acceptTerms` do `signupFormSchema` e do `SignupFormValues`. Manter `confirmPassword` + refine de igualdade. `password` min 6 (inalterado).

**`cadastro/page.tsx`**: classe raiz `.auth-light` (não usar `.auth-theme`/`.auth-card`); logo + título/subtítulo centralizados; sem card wrapper.

## Estados / A11y
- Validação inline pt-BR (`FormMessage`, `text-destructive`); CTA `disabled={!isValid||isSubmitting}` + loading "Criando conta...".
- `<main aria-label>`, labels associadas, `aria-required`, ícones decorativos `aria-hidden`; toggles de senha 44px; foco visível (ring verde).
- CTA `h-11`.

## Divergências conhecidas (intencionais)
- Confirmar senha mantido (mock não mostra) — decisão de produto.
- Sem checklist de senha ao vivo nem regra de número (mock mostra) — mantido min 6.
- Labels "E-mail" pt-BR.
