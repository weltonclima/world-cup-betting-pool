# SCREEN — RECUPERACAO-SENHA TASK-03: `(auth)/esqueci-senha` (telas 02 + 03)

> Fonte de verdade: `docs/prd-01-1/02-informar-email.png` (tela "Recuperar senha") e `docs/prd-01-1/03-email-enviado.png` (tela "Email enviado!"). Contrato: `design-system/MASTER.md` (§2.4-auth). Spec: `ai/spec/recuperacao-senha-task-01.md`; plano `ai/plan/recuperacao-senha.md` (TASK-03).
>
> **BottomNav ignorado.** Os mocks 02/03 exibem uma barra inferior (Home/Jogos/Palpites/Ranking/Perfil), mas a rota vive no grupo `(auth)`, que **não monta `AppShell`/`BottomNav`**. A barra **não** é renderizada. Reusa o **layout de duas zonas** (hero verde escuro `.auth-theme` + cartão claro `.auth-card`) do login.
>
> **Rota única, dois estados locais** (`useState`, **não** rotas separadas): `form` (tela 02) → `enviado` (tela 03). Transição após `sendPasswordReset` resolver.

## Tema — duas zonas (`globals.css`)

Idêntico ao login (TASK-07):
- `.auth-theme` (raiz da página): hero verde escuro, texto branco, `--primary` verde (`oklch(0.46 0.16 150)`), `--primary-foreground` branco, `--ring` verde, `--muted-foreground` claro p/ subtítulo.
- `.auth-card` (cartão aninhado): superfície **clara** (branco), `--foreground` escuro, `--input`/`--border` claros, `--muted-foreground` cinza; herda o `--primary` verde para CTA e links.

Contraste AA: CTA branco-sobre-verde; ícone de confirmação e link verde-sobre-branco; hero branco-sobre-verde-escuro. (Ver MASTER §2.4-auth.)

## Layout — estado `form` (tela 02, mobile-first)

```
[ .auth-theme · min-h-screen · flex col · bg-background (verde escuro) ]
  ├─ <section> hero · px-6 pt-12 pb-8 · flex col items-center gap-6
  │    ├─ AuthLogo variant="cadastro"   (logo vertical verde, centralizado)
  │    └─ <div max-w-sm w-full · text-center>
  │         h1 "Recuperar senha"  text-2xl font-bold text-foreground
  │         p  "Informe o e-mail da sua conta que enviaremos um link para
  │             redefinir sua senha."  mt-1 text-sm text-muted-foreground
  └─ <section> .auth-card · flex-1 · rounded-t-3xl · bg-card · px-6 pt-8 pb-10 · shadow-lg
       └─ <div max-w-sm mx-auto · flex col gap-6>
            └─ ForgotPasswordForm  (state="form")
                 ├─ Field E-mail  (Input type=email, placeholder "seu@email.com",
                 │                  leftIcon <Mail size={18}/> decorativo, autoComplete=email)
                 │    └─ FormMessage (validação inline pt-BR)
                 ├─ Button "Enviar link"        variant=default (verde) w-full h-11 (loading)
                 └─ Button "Voltar para o login" variant=outline  w-full h-11  asChild → <Link href="/login">
```

## Layout — estado `enviado` (tela 03)

```
[ .auth-theme · min-h-screen · flex col · bg-background ]
  ├─ <section> hero · px-6 pt-12 pb-8 · flex col items-center gap-6
  │    └─ AuthLogo variant="cadastro"   (mesmo hero; logo permanece)
  └─ <section> .auth-card · flex-1 · rounded-t-3xl · bg-card · px-6 pt-8 pb-10 · shadow-lg
       └─ <div max-w-sm mx-auto · flex col items-center gap-5 · text-center>
            ├─ <div role="status" aria-live="polite">   (anuncia a confirmação)
            │    ├─ ícone  envelope + check  →  círculo verde claro
            │    │     <span class="flex size-20 items-center justify-center rounded-full bg-primary/10">
            │    │       <MailCheck size={40} class="text-primary" aria-hidden />
            │    │     (alternativa: <Mail/> com <CheckCircle2/> sobreposto; MailCheck é 1 ícone só)
            │    ├─ h1 "Email enviado!"          text-2xl font-bold text-foreground
            │    ├─ p  "Enviamos um link para redefinir sua senha para:"
            │    │       text-sm text-muted-foreground
            │    ├─ p  {emailDigitado}            font-semibold text-primary  break-all
            │    └─ p  "Verifique sua caixa de entrada e também a pasta de spam."
            │            text-sm text-muted-foreground
            └─ Button "Voltar para o login"  variant=outline w-full h-11 asChild → <Link href="/login">
```

## Componente — `ForgotPasswordForm`
**Arquivos:** `src/app/(auth)/esqueci-senha/page.tsx` (server component: monta hero + `.auth-card` + `<ForgotPasswordForm/>`) · `src/features/auth/ForgotPasswordForm.tsx` (`"use client"`).

- Estado local: `const [state, setState] = useState<"form" | "enviado">("form")` e `const [sentEmail, setSentEmail] = useState("")`. O form e a confirmação coexistem no mesmo componente cliente (a página é a casca de layout).
- RHF + `zodResolver(forgotPasswordSchema)` via Shadcn `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`. Campo Email: `type="email" autoComplete="email" inputMode="email"`.
- Submit → `await sendPasswordReset(values.email)` de `@/services/auth`. Em caso de **resolve**: `setSentEmail(values.email); setState("enviado")`. **Anti-enumeração:** `user-not-found` já é engolido no serviço (TASK-02), então o caminho de sucesso é sempre atingido para e-mail válido — **sempre** mostra a tela 03.
- Erro (rede/`too-many-requests`/etc.): `toast.error(mapAuthError(code))` com narrowing seguro do `code` (sem `any`); permanece no estado `form`.
- "Voltar para o login" em ambos os estados → `Button asChild` + `next/link` `href="/login"`.
- Ícone do estado `enviado`: **`MailCheck`** (lucide) num círculo `bg-primary/10` — replica o envelope-com-check do mock com 1 ícone. `CheckCircle2` fica como fallback documentado.

## Estados / Acessibilidade / Responsivo

- **Loading:** durante o submit, `Button "Enviar link"` desabilitado + spinner (`Loader2 animate-spin motion-reduce:animate-none`); evita duplo envio.
- **Validação:** inline pt-BR via `FormMessage` (`text-destructive`); `aria-invalid`/`aria-describedby` automáticos do Shadcn `Form`.
- **Transição form→enviado:** a região de confirmação usa `role="status" aria-live="polite"` para anunciar "Email enviado!" a leitores de tela. **Foco** move para o heading do estado `enviado` (`ref` + `.focus()` em `useEffect` quando `state === "enviado"`; heading com `tabIndex={-1}`).
- **Touch targets ≥44px:** todos os botões `h-11` (44px). Sem toggles de senha nesta tela (sem `PasswordInput` aqui).
- **Foco visível:** ring verde herdado do tema; labels associadas via `FormLabel`/`htmlFor`.
- **Responsivo:** mobile-first; cartão `flex-1 rounded-t-3xl` (estética bottom-sheet) ocupa o restante; conteúdo `max-w-sm mx-auto`. `sm+` mantém o mesmo `max-w-sm` centralizado.
- **Sem BottomNav** (grupo `(auth)`).

## Divergências conhecidas vs mock (intencionais/menores)

- **BottomNav removido** — presente nos mocks 02/03, ausente por contrato do grupo `(auth)`. Divergência intencional principal.
- **Logo:** mock mostra a marca compacta; reusamos `AuthLogo variant="cadastro"` (vertical verde) para consistência com o padrão hero do login. Trivial.
- **"Voltar para o login"** renderizado como `variant=outline` (mock mostra botão claro secundário) — fiel ao mock; difere do CTA verde primário.
- **Ícone:** `MailCheck` (envelope+check em 1 glifo) no lugar da composição envelope+badge do mock — equivalente visual.
- **Label "E-mail"** (pt-BR) vs "Email" do mock — trivial.
- **Botão "Atualizar"/reenviar** não existe nos mocks 02/03 e **não** é adicionado (fora de escopo).
