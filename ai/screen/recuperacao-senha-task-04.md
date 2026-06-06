# SCREEN — RECUPERACAO-SENHA TASK-04: Redefinir senha (`(auth)/redefinir-senha`)

> Fonte de verdade: `docs/prd-01-1/04-nova-senha.png` (tela 04 "Definir nova senha") e `docs/prd-01-1/05-senha-alterada.png` (tela 05 "Senha alterada com sucesso"). Contrato: `design-system/MASTER.md` (§2.4-auth). Plano: `ai/plan/recuperacao-senha.md` (TASK-04). Schemas: `ai/spec/recuperacao-senha-task-01.md` (`resetPasswordSchema`). Serviço: `ai/spec/recuperacao-senha-task-02.md` (`verifyResetCode`/`confirmReset`).
>
> **SEM BottomNav.** Os mockups 04/05 desenham a barra inferior (Home/Jogos/Palpites/Ranking/Perfil), mas o grupo `(auth)` **não tem `AppShell`** → a barra é **ignorada deliberadamente** (usuário deslogado). Mesma decisão do TASK-07 (login).

## Tema — duas zonas (reusa `.auth-theme` + `.auth-card`)

Mesma estrutura do login (`src/app/(auth)/login/page.tsx`):
- `.auth-theme` (raiz da página): hero verde escuro, texto branco, `--primary` verde, `AuthLogo variant="login"`.
- `.auth-card` (cartão aninhado, bottom-sheet): superfície clara, herda `--primary` verde para CTA e links.

Cores do checklist (dentro do `.auth-card`, claro):
- Regra **satisfeita**: `text-primary` (verde) + ícone `CheckCircle2`.
- Regra **pendente**: `text-muted-foreground` (cinza) + ícone `Circle`.
- Sucesso (tela 05): círculo verde `bg-primary text-primary-foreground` com `CheckCircle2`/`Check`.

## Layout (mobile-first) — UMA rota, QUATRO estados (máquina local)

`oobCode`/`mode` lidos da query string via `useSearchParams()`. No mount, `verifyResetCode(oobCode)` decide entre `valido` e `invalido`. O hero (logo + título) é **constante**; só o corpo do `.auth-card` troca por estado.

### Estado A — `verificando` (loading inicial)
```
[ .auth-theme · min-h-screen · flex col · bg-background (verde) ]
  ├─ <section> hero · px-6 pt-12 pb-8 · flex col items-center gap-6
  │    ├─ AuthLogo variant="login"
  │    └─ <div max-w-sm w-full>
  │         h1 "Redefinir senha"   text-2xl font-bold text-foreground
  └─ <section> .auth-card · flex-1 rounded-t-3xl bg-card px-6 pt-8 pb-10 shadow-lg
       └─ <div max-w-sm mx-auto · flex col items-center gap-4 py-10>
            ├─ <Loader2 className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
            └─ <p role="status" aria-live="polite" text-sm text-muted-foreground>
                 "Validando o link de redefinição…"
```

### Estado B — `valido` (tela 04: formulário) ← SOURCE: 04-nova-senha.png
```
  └─ <section> .auth-card …
       └─ <div max-w-sm mx-auto · flex col gap-6>
            ├─ <header>
            │    h2 "Definir nova senha"   text-xl font-semibold text-foreground
            │    p  "Crie uma nova senha para sua conta."  text-sm text-muted-foreground
            └─ ResetPasswordForm                       (RHF + zodResolver(resetPasswordSchema))
                 ├─ FormField "Nova senha"
                 │    └─ PasswordInput autoComplete="new-password" placeholder="••••••••" (toggle olho 44px)
                 │    └─ FormMessage (inline, text-destructive)
                 ├─ FormField "Confirmar nova senha"
                 │    └─ PasswordInput autoComplete="new-password" placeholder="••••••••"
                 │    └─ FormMessage
                 ├─ PasswordChecklist  (ul, aria-live="polite") — atualiza ao vivo:
                 │    ☑ Mínimo de 8 caracteres        (REAL — reflete schema)
                 │    ☑ Letras e números              (REAL — reflete schema)
                 │    ⓘ Não pode ser igual à anterior (INFORMATIVO — sempre "satisfeito"/neutro)
                 └─ Button "Redefinir senha"  variant=default w-full h-11 (loading → spinner)
```

### Estado C — `sucesso` (tela 05) ← SOURCE: 05-senha-alterada.png
```
  └─ <section> .auth-card …
       └─ <div max-w-sm mx-auto · flex col items-center text-center gap-6 py-6>
            ├─ <div className="flex size-16 items-center justify-center rounded-full bg-primary">
            │      <Check className="size-8 text-primary-foreground" aria-hidden />
            ├─ <div role="status" aria-live="polite">
            │      h2 "Senha alterada com sucesso!"  text-xl font-semibold text-foreground
            │      p  "Sua senha foi redefinida. Agora você pode acessar sua conta com a nova senha."
            │         text-sm text-muted-foreground
            └─ <Button asChild variant=default w-full h-11>
                   <Link href="/login">Ir para o login</Link>
```

### Estado D — `invalido` (oobCode ausente/expirado/usado)
```
  └─ <section> .auth-card …
       └─ <div max-w-sm mx-auto · flex col items-center text-center gap-6 py-6>
            ├─ <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            │      <AlertCircle className="size-8 text-destructive" aria-hidden />
            ├─ <div role="alert" aria-live="assertive">
            │      h2 "Link inválido ou expirado"   text-xl font-semibold text-foreground
            │      p  "Este link de redefinição não é mais válido. Solicite um novo para continuar."
            │         text-sm text-muted-foreground
            └─ <Button asChild variant=default w-full h-11>
                   <Link href="/esqueci-senha">Solicitar novo link</Link>
```

## Componentes / arquivos

### `src/app/(auth)/redefinir-senha/page.tsx` (Server Component casca + Suspense)
- Renderiza o hero (`.auth-theme`, `AuthLogo variant="login"`, `h1 "Redefinir senha"`) e o `.auth-card`.
- **`useSearchParams()` exige `Suspense` no Next 15** (senão a página inteira vira CSR / erro de build com `output`). Padrão: a página é Server Component e envolve o cliente em `<Suspense fallback={<ResetPasswordFallback />}>`. O `fallback` reusa o visual do Estado A (`verificando`). Toda a lógica de estados/query fica no Client Component filho.
- Filho client: `ResetPasswordClient` (pode morar no mesmo arquivo `ResetPasswordForm.tsx` ou em `redefinir-senha/_client.tsx`) — lê `useSearchParams()`, mantém a state machine.

### `src/features/auth/ResetPasswordForm.tsx` (Client Component — `"use client"`)
- **Estado:** `type ResetState = "verificando" | "valido" | "sucesso" | "invalido"`; `useState<ResetState>("verificando")`.
- **oobCode:** `const params = useSearchParams(); const oobCode = params.get("oobCode"); const mode = params.get("mode");`
- **Mount:** `useEffect` → se `!oobCode` (ou `mode !== "resetPassword"`) → `setState("invalido")`; senão `verifyResetCode(oobCode).then(() => setState("valido")).catch(() => setState("invalido"))`. Guard contra setState pós-unmount (flag `active`).
- **Form (estado `valido`):** Shadcn `Form` + `useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), mode: "onChange" })`. `mode: "onChange"` para o checklist refletir validação ao vivo.
- **Checklist ao vivo:** `const password = form.watch("password")` alimenta `<PasswordChecklist value={password} />`.
- **Submit:** `confirmReset(oobCode!, values.password)` → sucesso `setState("sucesso")`; erro `toast.error(mapAuthError((e as { code?: string }).code))` (narrowing seguro, sem `any`). Botão desabilita + spinner `motion-reduce:animate-none` durante `isSubmitting`.
- **Renderização por estado:** `switch (state)` → A/B/C/D conforme ASCII acima. CTAs C/D via `next/link` (`Button asChild`).

### `src/features/auth/PasswordChecklist.tsx` (novo, Client — pequeno e puro)
```ts
interface PasswordChecklistProps { value: string; }
// Regras derivadas do schema (RESET_PASSWORD_MIN_LENGTH = 8):
//  - hasMinLength: value.length >= 8
//  - hasLetterAndNumber: /[A-Za-z]/.test(value) && /[0-9]/.test(value)
//  - notSameAsPrevious: SEMPRE informativo (ver Divergências) — não derivado de value
```
- Renderiza `<ul aria-live="polite">` com 3 `<li className="flex items-center gap-2 text-sm">`.
- Item satisfeito: `<CheckCircle2 className="size-4 text-primary" aria-hidden />` + texto `text-primary`/`text-foreground`.
- Item pendente: `<Circle className="size-4 text-muted-foreground" aria-hidden />` + texto `text-muted-foreground`.
- Estado textual para leitor de tela por item: sufixo visualmente oculto (`sr-only`) "— concluído" / "— pendente" para não depender só de cor/ícone.
- Reuso: ícones de `lucide-react` (`CheckCircle2`, `Circle`). Sem dependência de RHF (recebe `value` por prop → testável isolado).

## Estados / Acessibilidade / Responsivo
- **Foco:** ao entrar em `valido`, foco no primeiro `PasswordInput` (ref). Ao entrar em `sucesso`/`invalido`, foco no heading (`tabIndex={-1}` + `.focus()`) para anunciar a mudança.
- **aria-live:** checklist `aria-live="polite"`; `verificando` `role="status"`; `sucesso` `role="status"`; `invalido` `role="alert"` (`assertive`). Erros de submit também via `toast` (Sonner, anuncia por padrão).
- **Validação inline pt-BR:** `FormMessage`/`text-destructive` nos dois campos (mensagens do `resetPasswordSchema`: "A senha deve ter pelo menos 8 caracteres.", "…ao menos uma letra.", "…ao menos um número.", "As senhas não coincidem.").
- **Cor não é o único canal:** checklist usa ícone + texto + `sr-only` de status, não apenas verde/cinza.
- **Touch ≥44px:** CTA `h-11` (44px); toggle olho do `PasswordInput` já é `h-11 w-11`.
- **reduced-motion:** spinners `animate-spin motion-reduce:animate-none`.
- **Responsivo:** mobile-first; conteúdo `max-w-sm mx-auto` dentro do card `flex-1 rounded-t-3xl` (bottom-sheet). Sem breakpoints adicionais necessários.
- **Sem BottomNav** (reafirmado): grupo `(auth)` não monta `AppShell`.

## Divergências conhecidas vs mock (intencionais)
- **"Não pode ser igual à anterior" (3º item do checklist):** **indicador informativo/decorativo**, NÃO validação bloqueante e NÃO está no `resetPasswordSchema` (A2 — o app não conhece a senha atual; Firebase resolve internamente). Renderizado sempre como item neutro/satisfeito (`CheckCircle2`) com `aria-label`/`sr-only` indicando que é informativo ("informativo — não validado"). Não impede o submit. Os outros 2 itens são validações reais derivadas do schema.
- **BottomNav presente nos mockups 04/05** → removida (grupo `(auth)`).
- **Logo:** mock mostra logo no topo do card; usamos `AuthLogo variant="login"` no hero verde (consistência com login real, MASTER §2.4-auth). Mock pinta fundo branco; nós usamos hero verde + card claro (bottom-sheet), conforme o padrão de duas zonas já implantado.
- **Header do card:** mock tela 04 traz "Definir nova senha" + subtítulo dentro do card; mantido. h1 "Redefinir senha" no hero é adição para dar título à rota multi-estado.
- **Estados `verificando`/`invalido`** não existem no mock (que só desenha 04 e 05); são exigências do fluxo real do `oobCode` (link de e-mail) e da máquina de estados do plano.
