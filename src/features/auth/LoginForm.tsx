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
import { setBiometricIntent } from "@/features/passkeys/lib/loginBiometricIntent";

/**
 * Formulário de login (PRD-01, TASK-07).
 *
 * React Hook Form + Zod (`loginFormSchema`) via Shadcn `Form`. Submete para a
 * camada de serviço (`signIn`) e, em caso de erro, exibe `toast.error` com a
 * mensagem traduzida (`mapAuthError`) — sem revelar existência de conta (R6).
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
  const [activate, setActivate] = useState(false);
  // localStorage não é reativo: lê uma vez no mount (evita mismatch de hidratação).
  const [hasHint, setHasHint] = useState(false);
  useEffect(() => {
    setHasHint(hasPasskeyHint());
  }, []);

  // Checkbox só faz sentido se há onde ativar e ainda não foi ativado neste device.
  const showActivate = supported === true && !isWebView && !hasHint;

  async function onSubmit(values: LoginFormValues) {
    try {
      await signIn(values.email, values.password);
      // Sucesso: o AuthLayout cuida do redirecionamento (não navegar aqui).
      // Intenção de ativar biometria → consumida pelo prompt pós-redirect.
      if (showActivate && activate) {
        setBiometricIntent();
      }
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

        {showActivate ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="activate-biometric"
              aria-label="Ativar biometria neste aparelho"
              checked={activate}
              onCheckedChange={(value) => setActivate(value === true)}
            />
            <Label
              htmlFor="activate-biometric"
              className="text-sm font-normal text-muted-foreground"
            >
              Ativar biometria neste aparelho
            </Label>
          </div>
        ) : null}

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
      </form>
    </Form>
  );
}
