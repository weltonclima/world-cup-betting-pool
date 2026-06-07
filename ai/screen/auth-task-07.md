# SCREEN — TASK-07: Tela de Login (revisado p/ login.png)

> Fonte de verdade: `docs/prd-01/login.png`. Contrato: `design-system/MASTER.md` (§2.4-auth). Sem BottomNav. **Layout de duas zonas** (hero verde escuro + cartão claro), conforme o mock.

## Tema — duas zonas (`globals.css`)

- `.auth-theme` (raiz da página): hero verde escuro, texto branco, `--primary` verde (`oklch(0.46 0.16 150)`) com `--primary-foreground` branco, `--ring` verde, `--muted-foreground` claro p/ subtítulo.
- `.auth-card` (cartão do form, aninhado): superfície **clara** (branco), `--foreground` escuro, `--input`/`--border` claros, `--muted-foreground` cinza; herda o `--primary` verde para CTA e links.

Contraste AA: CTA branco-sobre-verde e links verde-sobre-branco; hero branco-sobre-verde-escuro. (Ver MASTER §2.4-auth.)

## Layout (mobile-first)

```
[ .auth-theme · min-h-screen · flex col · bg-background (verde escuro) ]
  ├─ <section> hero · px-6 pt-12 pb-8 · flex col items-center gap-6
  │    ├─ AuthLogo variant="login"  (troféu VERDE, centralizado)
  │    └─ <div max-w-sm w-full>      (boas-vindas ALINHADAS À ESQUERDA)
  │         h1 "Bem-vindo de volta!"  text-2xl font-bold text-foreground
  │         p  "Faça login para continuar."  text-sm text-muted-foreground
  └─ <section> .auth-card · flex-1 · rounded-t-3xl · bg-card · px-6 pt-8 pb-10 · shadow-lg
       └─ <div max-w-sm mx-auto · flex col gap-6>
            ├─ LoginForm
            │    ├─ Field E-mail  (Input, placeholder "seu@email.com")
            │    ├─ Field Senha   (PasswordInput, placeholder "Sua senha", toggle olho)
            │    │    └─ "Esqueci minha senha"  link verde, alinhado à direita (placeholder ativo A4)
            │    └─ Button "Entrar"  variant=default (verde) w-full h-11  (loading state)
            └─ footer  "Não tem conta? " + <Link/> "Cadastre-se" (verde, centralizado)
```

## Componente — `LoginForm`
**Arquivo:** `src/features/auth/LoginForm.tsx` · página `src/app/(auth)/login/page.tsx`

- RHF + `zodResolver(loginFormSchema)` via Shadcn `Form`. Campos Email (`type=email autoComplete=email`) e Senha (`PasswordInput autoComplete=current-password`).
- Submit → `signIn(email, password)`; erro → `toast.error(mapAuthError(code))` (narrowing seguro, sem `any`). Sucesso: `AuthLayout` redireciona (não navegar manual).
- "Esqueci minha senha": placeholder **ativo** (toast "Em breve") — A4 em outra PRD.
- "Cadastre-se" → `next/link` `/cadastro` (no footer da página).

## Estados / Acessibilidade / Responsivo
- Validação inline pt-BR (`FormMessage`, `text-destructive`); loading desabilita CTA + spinner `motion-reduce:animate-none`.
- `<section>` hero + cartão; labels associadas; `aria-invalid`/`aria-describedby` via Shadcn; foco visível (ring verde); toggle de senha 44px.
- CTA `h-11` (44px). Cartão `flex-1 rounded-t-3xl` ocupa o restante (estética bottom-sheet); conteúdo `max-w-sm` centralizado. Sem BottomNav.

## Divergências conhecidas vs mock (intencionais/menores)
- Labels "E-mail"/"Senha" (pt-BR) vs "Email"/"Senha" do mock — trivial.
- Sem ícones internos (envelope/cadeado) nos inputs — opcional, fora de escopo.
