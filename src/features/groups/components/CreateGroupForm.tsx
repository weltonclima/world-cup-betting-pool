"use client";

import { useRef, useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";

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
import {
  AvatarImageError,
  fileToCompressedDataUrl,
} from "@/features/profile/lib/imageToDataUrl";
import { PoolServiceError } from "@/services/pools";

import { useCreateGroup } from "../hooks";
import {
  createGroupFormSchema,
  GROUP_DESCRIPTION_MAX_LENGTH,
  suggestSlug,
  type CreateGroupFormValues,
} from "../schemas";

/**
 * Formulário "Criar Grupo" (PRD-09, TASK-08 — tela PRD09-01).
 *
 * Campos: nome (obrigatório), slug (obrigatório, auto-sugerido do nome até o
 * usuário editar, `^[a-z0-9-]+$`), descrição (opcional, ≤160 com contador) e foto
 * (opcional, comprimida em base64 no client — reusa o utilitário do avatar, sem
 * Firebase Storage). No sucesso, chama `onCreated` (a página troca para a tela de
 * "Solicitação Enviada"). Erro 409 (slug em uso) é exibido inline no campo slug.
 */
export function CreateGroupForm({
  onCreated,
}: {
  onCreated: () => void;
}): JSX.Element {
  const createGroup = useCreateGroup();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  // Trava a auto-sugestão de slug assim que o usuário edita o campo manualmente.
  const slugTouched = useRef(false);

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupFormSchema),
    mode: "onChange",
    defaultValues: { name: "", slug: "", description: "" },
  });

  const { isValid, isSubmitting } = form.formState;
  const description = form.watch("description") ?? "";

  function onPickPhoto(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reselecionar o mesmo arquivo
    if (!file) return;
    void (async () => {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        setPhotoBase64(dataUrl);
      } catch (error) {
        toast.error(
          error instanceof AvatarImageError
            ? error.message
            : "Não foi possível usar essa imagem.",
        );
      }
    })();
  }

  async function onSubmit(values: CreateGroupFormValues): Promise<void> {
    try {
      await createGroup.mutateAsync({
        name: values.name,
        slug: values.slug,
        description: values.description?.trim() ? values.description.trim() : undefined,
        photoBase64,
      });
      onCreated();
    } catch (error) {
      // 409 = slug já em uso → erro inline no campo (PNG: validação do slug).
      if (error instanceof PoolServiceError && error.status === 409) {
        form.setError("slug", { type: "server", message: error.message });
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o grupo. Tente novamente.",
      );
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Nome do Grupo <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl
                render={
                  <Input
                    type="text"
                    placeholder="Ex.: Bolão dos Parças"
                    aria-required="true"
                    className="h-11"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event);
                      // Auto-sugere o slug enquanto o usuário não editou o campo slug.
                      if (!slugTouched.current) {
                        form.setValue("slug", suggestSlug(event.target.value), {
                          shouldValidate: true,
                        });
                      }
                    }}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Slug do Grupo <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl
                render={
                  <Input
                    type="text"
                    placeholder="Ex.: bolao-dos-parcas"
                    aria-required="true"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-11"
                    {...field}
                    onChange={(event) => {
                      slugTouched.current = true;
                      field.onChange(event);
                    }}
                  />
                }
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras, números e hifens.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (opcional)</FormLabel>
              <FormControl
                render={
                  <textarea
                    placeholder="Fale um pouco sobre o seu grupo"
                    maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
                    {...field}
                  />
                }
              />
              <p className="text-right text-xs text-muted-foreground">
                {description.length}/{GROUP_DESCRIPTION_MAX_LENGTH}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Foto do grupo (opcional) — base64 comprimida no client */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            Foto do Grupo (opcional)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickPhoto}
          />
          {photoBase64 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoBase64}
                alt="Pré-visualização da foto do grupo"
                className="size-16 shrink-0 rounded-lg object-cover"
              />
              <div className="flex flex-1 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] text-left text-sm font-medium text-primary hover:underline"
                >
                  Trocar foto
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoBase64(undefined)}
                  className="flex min-h-[44px] items-center gap-1 text-left text-sm text-muted-foreground hover:underline"
                >
                  <X size={14} aria-hidden="true" /> Remover
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground transition-colors hover:bg-muted"
            >
              <ImagePlus size={28} aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">
                Clique para enviar
              </span>
              <span className="text-xs">PNG, JPG até 2MB</span>
            </button>
          )}
        </div>

        <Button
          type="submit"
          variant="default"
          disabled={!isValid || isSubmitting}
          className="h-12 w-full"
        >
          {isSubmitting ? "Criando..." : "Criar Grupo"}
        </Button>
      </form>
    </Form>
  );
}
