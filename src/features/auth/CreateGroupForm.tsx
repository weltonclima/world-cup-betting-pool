"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AtSign,
  CheckCircle2,
  LoaderCircle,
  Lock,
  Mail,
  MailCheck,
  Trophy,
  User,
} from "lucide-react";

import {
  createGroupFormSchema,
  type CreateGroupFormValues,
} from "@/features/auth/schemas";
import { mapAuthError } from "@/features/auth/errors";
import {
  activateMyPool,
  createGroupAndAccount,
  OnboardingSubmitError,
} from "@/services/onboarding";
import { InviteValue, inviteUrl } from "@/components/invite/InviteValue";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/**
 * Formulário de onboarding auto-serviço "Criar grupo" (multi-championship TASK-16).
 *
 * Duas fases num único client component: `form` (coleta + submit) → `success`
 * (exibe o link de convite via `InviteValue` + CTA de navegação). A rota
 * `POST /api/signup/create-group` é a autoridade sobre papel/status/identidade;
 * este form só coleta dados e reage ao resultado.
 *
 * `mode: "onChange"` (consistente com `SignupForm`) habilita o CTA apenas quando
 * o formulário é válido. `confirmPassword` é validação exclusiva do frontend.
 */

/** Slug de PREVIEW (cosmético): a autoridade do slug é server-side na rota. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico → hífen
    .replace(/^-+|-+$/g, ""); // apara hífens das pontas
}

interface SuccessState {
  groupName: string;
  inviteCode: string;
  slug: string;
  /** Pool nasceu `pending` (e-mail não verificado) — exige o passo de verificação. */
  pending: boolean;
}

export function CreateGroupForm() {
  const router = useRouter();
  const [success, setSuccess] = useState<SuccessState | null>(null);
  // Loading local do botão "Já verifiquei" (chamada a `activate-pool`).
  const [verifying, setVerifying] = useState(false);

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      nickname: "",
      email: "",
      groupName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { isValid, isSubmitting } = form.formState;
  const groupNameValue = form.watch("groupName");
  const slugPreview = slugify(groupNameValue ?? "");

  async function onSubmit(values: CreateGroupFormValues) {
    const slug = slugify(values.groupName);
    if (!slug) {
      form.setError("groupName", {
        message: "Escolha um nome de grupo com letras ou números.",
      });
      form.setFocus("groupName");
      return;
    }
    try {
      const result = await createGroupAndAccount({
        name: values.name,
        nickname: values.nickname,
        email: values.email,
        password: values.password,
        groupName: values.groupName,
        slug,
      });
      setSuccess({
        groupName: values.groupName,
        inviteCode: result.inviteCode,
        slug: result.slug,
        pending: result.pending,
      });
    } catch (error) {
      if (error instanceof OnboardingSubmitError) {
        toast.error(error.message);
        if (error.kind === "slug-taken") form.setFocus("groupName");
        return;
      }
      toast.error(mapAuthError((error as { code?: string }).code ?? ""));
    }
  }

  /**
   * "Já verifiquei meu e-mail": recarrega o usuário, chama `activate-pool` e trata
   * os três desfechos por toast. Só promove no servidor se o e-mail estiver mesmo
   * verificado (BR4) — o botão nunca decide status por conta própria.
   */
  async function onConfirmVerified() {
    setVerifying(true);
    try {
      const { ok, activated } = await activateMyPool();
      if (ok && activated > 0) {
        setSuccess((prev) => (prev ? { ...prev, pending: false } : prev));
        toast.success("Seu grupo já está visível na busca!");
      } else if (ok) {
        // Verificado, mas nada pendente (já promovido antes) — reflete o estado.
        setSuccess((prev) => (prev ? { ...prev, pending: false } : prev));
        toast.success("Tudo certo! Seu grupo já está ativo.");
      } else {
        toast.info(
          "Ainda não confirmamos seu e-mail. Clique no link que enviamos e tente de novo.",
        );
      }
    } catch {
      toast.error("Não foi possível verificar agora. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  }

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle2
            size={40}
            aria-hidden="true"
            className="text-success"
          />
          <h1 className="text-2xl font-bold text-foreground">Grupo criado!</h1>
          <p className="text-sm text-muted-foreground">
            {success.pending ? (
              <>
                <strong>{success.groupName}</strong> foi criado. Verifique seu
                e-mail para deixá-lo visível na busca.
              </>
            ) : (
              <>
                <strong>{success.groupName}</strong> está ativo. Convide as
                pessoas para começar.
              </>
            )}
          </p>
        </div>

        {success.pending ? (
          <div
            role="note"
            className="flex items-start gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-left text-sm text-muted-foreground"
          >
            <MailCheck aria-hidden className="h-4 w-4 shrink-0" />
            <span>
              Enviamos um link de verificação para seu e-mail. Confirme para o
              grupo aparecer na busca pública.
            </span>
          </div>
        ) : null}

        <InviteValue
          title="Link de convite"
          description="Compartilhe para as pessoas entrarem no seu grupo."
          value={inviteUrl(success.inviteCode)}
          shareLabel="Compartilhar convite"
          empty={false}
        />

        {success.pending ? (
          <Button
            type="button"
            variant="outline"
            onClick={onConfirmVerified}
            disabled={verifying}
            aria-busy={verifying}
            className="h-11 w-full border-primary text-primary hover:bg-primary/10"
          >
            {verifying ? (
              <>
                <LoaderCircle
                  aria-hidden
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                />
                Verificando...
              </>
            ) : (
              "Já verifiquei meu e-mail"
            )}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="default"
          onClick={() => router.push("/group")}
          className="h-11 w-full"
        >
          Ir para o meu grupo
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo</FormLabel>
              <FormControl
                render={
                  <div className="relative">
                    <User
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="text"
                      autoComplete="name"
                      placeholder="Digite seu nome completo"
                      aria-required="true"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Apelido</FormLabel>
              <FormControl
                render={
                  <div className="relative">
                    <AtSign
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="text"
                      autoComplete="nickname"
                      placeholder="Digite seu apelido"
                      aria-required="true"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl
                render={
                  <div className="relative">
                    <Mail
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Digite seu melhor email"
                      aria-required="true"
                      className="pl-9"
                      {...field}
                    />
                  </div>
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
                    autoComplete="new-password"
                    placeholder="Digite sua senha"
                    aria-required="true"
                    leftIcon={<Lock size={18} aria-hidden="true" />}
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
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar senha</FormLabel>
              <FormControl
                render={
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Confirme sua senha"
                    aria-required="true"
                    leftIcon={<Lock size={18} aria-hidden="true" />}
                    {...field}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="h-px bg-border" aria-hidden="true" />

        <FormField
          control={form.control}
          name="groupName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do grupo</FormLabel>
              <FormControl
                render={
                  <div className="relative">
                    <Trophy
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="text"
                      autoComplete="off"
                      placeholder="Ex.: Bolão da firma"
                      aria-required="true"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                }
              />
              <p
                aria-live="polite"
                className="min-h-[1rem] font-mono text-xs text-muted-foreground"
              >
                {slugPreview ? `bolao.app/invite/${slugPreview}` : ""}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant="default"
          disabled={!isValid || isSubmitting}
          className="h-11 w-full"
        >
          {isSubmitting ? "Criando grupo..." : "Criar grupo e conta"}
        </Button>
      </form>
    </Form>
  );
}
