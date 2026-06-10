"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { loginFormSchema, type LoginFormValues } from "@/features/auth/schemas";
import { mapAuthError } from "@/features/auth/errors";
import { signIn } from "@/services/auth";
import { usePasskeySupport } from "@/features/passkeys/hooks";
import { hasPasskeyHint } from "@/features/passkeys/lib/passkeyHint";
import {
  clearBiometricIntent,
  hasBiometricIntent,
  setBiometricIntent,
} from "@/features/passkeys/lib/loginBiometricIntent";
import { useBiometricLogin } from "@/features/auth/hooks/useBiometricLogin";

/**
 * Formulário de login (PRD-01, TASK-07 + feature login-biometric-activation).
 *
 * React Hook Form + Zod (`loginFormSchema`) via Shadcn `Form`. Submete para a
 * camada de serviço (`signIn`) e, em caso de erro, exibe `toast.error` com a
 * mensagem traduzida (`mapAuthError`) — sem revelar existência de conta (R6).
 *
 * Checkbox "biometria" (sempre visível em device capaz) é o ÚNICO controle do
 * login biométrico — decide o modo do botão "Entrar":
 *  - device COM passkey (`hasHint`) + marcado → "Entrar" dispara a cerimônia
 *    WebAuthn direto (usernameless, ignora e-mail/senha);
 *  - device SEM passkey + marcado → login por senha normal + grava a intenção
 *    (sessionStorage) → o prompt pós-login (`BiometricActivationPrompt`) cria o
 *    passkey (1 toque — req. de gesto recente do iOS);
 *  - desmarcado → login por senha puro.
 * Fallback e-mail+senha NUNCA some (M3); os campos ficam sempre na tela.
 *
 * Não navega manualmente no sucesso: o `AuthLayout` redireciona aprovados →
 * /home assim que o estado de auth muda.
 */
export function LoginForm() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  const { supported, isWebView } = usePasskeySupport();
  const biometricLogin = useBiometricLogin();
  const [activate, setActivate] = useState(false);
  // Storage não é reativo: lê uma vez no mount (evita mismatch de hidratação).
  const [hasHint, setHasHint] = useState(false);
  useEffect(() => {
    const hint = hasPasskeyHint();
    setHasHint(hint);
    // Estado inicial do checkbox: marcado se o device já tem passkey (biometria é
    // o método salvo → default da tela) OU se há intenção persistida (sobrevive ao
    // reload da aba). Peek, não consome — o consumo é só do prompt pós-login.
    setActivate(hint || hasBiometricIntent());
  }, []);

  // Marca/desmarca persistindo a intenção NA HORA (não no submit): o estado
  // sobrevive ao reload e, quando o device ainda não tem passkey, a intenção já
  // fica gravada antes do login — sem race com o prompt pós-login.
  function handleActivateChange(checked: boolean): void {
    setActivate(checked);
    if (checked) setBiometricIntent();
    else clearBiometricIntent();
  }

  // Checkbox de biometria: visível em todo device capaz (não-WebView). É o único
  // controle do login biométrico.
  const showBiometric = supported === true && !isWebView;
  // Modo "entrar por biometria direto": só faz sentido com passkey já salvo.
  const biometricDirect = showBiometric && activate && hasHint;

  async function onSubmit(values: LoginFormValues) {
    try {
      await signIn(values.email, values.password);
      // Sucesso: o AuthLayout cuida do redirecionamento (não navegar aqui).
      // Se o checkbox está marcado e o device ainda NÃO tem passkey, a intenção
      // já foi gravada ao marcar — o prompt pós-redirect a consome e cadastra.
    } catch (error) {
      // Narrowing seguro do código do FirebaseError (sem `any`).
      const code = (error as { code?: string }).code ?? "";
      toast.error(mapAuthError(code));
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl
                render={
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    {...field}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl
                render={
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    {...field}
                  />
                }
              />
              <FormMessage />
              <div className="flex justify-end">
                {/* Recuperação de senha (PRD-01.1) — rota dedicada. */}
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </FormItem>
          )}
        />

        {showBiometric ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="activate-biometric"
              aria-label={
                hasHint
                  ? "Entrar com biometria"
                  : "Ativar biometria neste aparelho"
              }
              checked={activate}
              onCheckedChange={(value) => handleActivateChange(value === true)}
            />
            <Label
              htmlFor="activate-biometric"
              className="text-sm font-normal text-muted-foreground"
            >
              {hasHint
                ? "Entrar com biometria"
                : "Ativar biometria neste aparelho"}
            </Label>
          </div>
        ) : null}

        {biometricDirect ? (
          // Device COM passkey + checkbox marcado: o "Entrar" dispara a cerimônia
          // WebAuthn direto (usernameless) — type="button" para NÃO validar/exigir
          // e-mail+senha (que ficam na tela mas são ignorados neste modo).
          <Button
            type="button"
            variant="default"
            className="h-11 w-full"
            onClick={() => biometricLogin.mutate()}
            disabled={biometricLogin.isPending}
            aria-busy={biometricLogin.isPending}
          >
            {biometricLogin.isPending ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {biometricLogin.isPending
              ? "Entrando com biometria…"
              : "Entrar com biometria"}
          </Button>
        ) : (
          <Button
            type="submit"
            variant="default"
            className="h-11 w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        )}
      </form>
    </Form>
  );
}
