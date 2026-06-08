"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { changePassword } from "@/services/auth";
import { cn } from "@/lib/utils";

import {
  changePasswordSchema,
  passwordRules,
  type ChangePasswordValues,
} from "../schemas";

/** Traduz erros do reauth/updatePassword para o contexto de troca de senha. */
function mapChangePasswordError(code: string): string {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Senha atual incorreta.";
    case "auth/weak-password":
      return "A nova senha é muito fraca.";
    case "auth/requires-recent-login":
      return "Por segurança, faça login novamente antes de trocar a senha.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos.";
    default:
      return "Não foi possível alterar a senha. Tente novamente.";
  }
}

/** Tela 04 — Alterar Senha (PRD06-04). */
export function ChangePasswordForm(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onTouched",
  });

  const newPassword = form.watch("newPassword");

  async function onSubmit(values: ChangePasswordValues): Promise<void> {
    setSubmitting(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      toast.success("Senha alterada com sucesso.");
      form.reset();
      router.back();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      toast.error(mapChangePasswordError(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ícone + intro */}
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck size={28} aria-hidden="true" />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">
          Por segurança, escolha uma senha forte e que você não utiliza em outros
          sites.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha Atual</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="Digite sua senha atual"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova Senha</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Digite sua nova senha"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar Nova Senha</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Digite novamente sua nova senha"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Checklist de regras (live) */}
          <ul
            aria-label="Requisitos da senha"
            className="flex flex-col gap-1.5 rounded-lg bg-primary/5 p-4"
          >
            <li className="text-xs font-medium text-foreground">
              A senha deve conter:
            </li>
            {passwordRules.map((rule) => {
              const ok = rule.test(newPassword ?? "");
              return (
                <li
                  key={rule.id}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    ok ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Check
                    size={14}
                    aria-hidden="true"
                    className={ok ? "opacity-100" : "opacity-30"}
                  />
                  {rule.label}
                </li>
              );
            })}
          </ul>

          <Button
            type="submit"
            className="h-12 w-full"
            disabled={submitting}
          >
            {submitting ? "Salvando…" : "Salvar Nova Senha"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
