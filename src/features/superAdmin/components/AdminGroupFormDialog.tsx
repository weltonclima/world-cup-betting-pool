"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Camera, LoaderCircle } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AvatarImageError,
  fileToCompressedDataUrl,
} from "@/features/profile/lib/imageToDataUrl";
import { MAX_POOL_PHOTO_BASE64_LENGTH } from "@/schemas/pools";
import {
  useCreateAdminGroup,
  useUpdateAdminGroup,
} from "@/features/superAdmin/hooks";
import type { AdminPoolRow } from "@/services/superAdmin";

const MAX_DESCRIPTION = 160;
const PHOTO_MAX_BYTES = Math.floor((MAX_POOL_PHOTO_BASE64_LENGTH * 3) / 4) - 1024;

/** Slug a partir do nome: minúsculas, sem acento, hífens. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Diálogo criar/editar grupo do super_admin (PRD-11). `pool` ausente = criar
 * (grupo nasce ativo, slug editável); presente = editar (slug imutável + limite e
 * convites). Só envia campos alterados no modo editar.
 */
export function AdminGroupFormDialog({
  open,
  onOpenChange,
  pool,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool?: AdminPoolRow;
}): JSX.Element {
  const isEdit = pool !== undefined;
  const create = useCreateAdminGroup();
  const update = useUpdateAdminGroup();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [maxParticipants, setMaxParticipants] = useState("");
  const [allowInvites, setAllowInvites] = useState(true);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sincroniza o estado ao abrir / trocar o pool-alvo.
  useEffect(() => {
    if (!open) return;
    setName(pool?.name ?? "");
    setSlug(pool?.slug ?? "");
    setSlugTouched(false);
    setDescription(pool?.description ?? "");
    setPhoto(pool?.photoBase64);
    setMaxParticipants(
      pool?.maxParticipants !== undefined ? String(pool.maxParticipants) : "",
    );
    setAllowInvites(pool?.allowInvites !== false);
    setPhotoError(null);
    setFormError(null);
  }, [open, pool]);

  async function onPickPhoto(file: File | undefined): Promise<void> {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setPhoto(await fileToCompressedDataUrl(file, PHOTO_MAX_BYTES));
    } catch (error) {
      setPhotoError(
        error instanceof AvatarImageError
          ? error.message
          : "Não foi possível processar a imagem.",
      );
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const trimmedName = name.trim();
  const effectiveSlug = isEdit ? slug : slugTouched ? slug : slugify(trimmedName);
  const maxNum = maxParticipants.trim() === "" ? null : Number(maxParticipants);
  const maxInvalid =
    maxNum !== null && (!Number.isInteger(maxNum) || maxNum < 1);
  const nameInvalid = trimmedName.length === 0;
  const slugInvalid = !isEdit && !/^[a-z0-9-]+$/.test(effectiveSlug);
  const pending = create.isPending || update.isPending;

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (nameInvalid || slugInvalid || maxInvalid || pending) return;
    setFormError(null);

    if (!isEdit) {
      create.mutate(
        {
          name: trimmedName,
          slug: effectiveSlug,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(photo ? { photoBase64: photo } : {}),
        },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err) => setFormError(err.message),
        },
      );
      return;
    }

    // Editar: envia só o que mudou.
    const patch: Record<string, unknown> = {};
    if (trimmedName !== pool.name) patch["name"] = trimmedName;
    if (description.trim() !== (pool.description ?? "")) {
      patch["description"] = description.trim();
    }
    if (photo !== pool.photoBase64 && photo !== undefined) {
      patch["photoBase64"] = photo;
    }
    if (maxNum !== (pool.maxParticipants ?? null)) {
      patch["maxParticipants"] = maxNum;
    }
    if (allowInvites !== (pool.allowInvites !== false)) {
      patch["allowInvites"] = allowInvites;
    }
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    update.mutate(
      { id: pool.id, patch },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setFormError(err.message),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar grupo" : "Criar grupo"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Atualize as informações de ${pool.name}.`
              : "O grupo nasce ativo. Defina um administrador depois em “Alterar Admin”."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {photo ? <AvatarImage src={photo} alt="" /> : null}
              <AvatarFallback className="bg-muted text-muted-foreground">
                <Camera size={20} aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy || pending}
              className="min-h-[44px]"
            >
              {photoBusy ? (
                <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Camera size={16} aria-hidden="true" />
              )}
              Foto
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onPickPhoto(e.target.files?.[0])}
            />
          </div>
          {photoError ? (
            <p role="alert" className="text-xs text-destructive">{photoError}</p>
          ) : null}

          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ag-name">Nome *</Label>
            <Input
              id="ag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-invalid={nameInvalid}
              className="h-11"
            />
          </div>

          {/* Slug (só criar) */}
          {!isEdit ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-slug">Identificador (slug) *</Label>
              <Input
                id="ag-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                aria-invalid={slugInvalid}
                className="h-11"
              />
              {slugInvalid ? (
                <p className="text-xs text-destructive">
                  Use apenas minúsculas, números e hífen.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ag-desc">Descrição</Label>
            <textarea
              id="ag-desc"
              value={description}
              maxLength={MAX_DESCRIPTION}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {/* Limite + convites (só editar) */}
          {isEdit ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ag-max">Limite de participantes</Label>
                <Input
                  id="ag-max"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Sem limite"
                  aria-invalid={maxInvalid}
                  className="h-11"
                />
                {maxInvalid ? (
                  <p className="text-xs text-destructive">
                    Informe um inteiro ≥ 1, ou deixe em branco.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
                <Label htmlFor="ag-invites" className="font-medium">
                  Permitir convites
                </Label>
                <Switch
                  id="ag-invites"
                  checked={allowInvites}
                  onCheckedChange={setAllowInvites}
                />
              </div>
            </>
          ) : null}

          {formError ? (
            <p role="alert" className="text-sm text-destructive">{formError}</p>
          ) : null}

          <DialogFooter>
            <DialogClose
              disabled={pending}
              render={<Button type="button" variant="outline" className="h-11">Cancelar</Button>}
            />
            <Button
              type="submit"
              disabled={nameInvalid || slugInvalid || maxInvalid || pending || photoBusy}
              aria-busy={pending}
              className="h-11"
            >
              {pending ? (
                <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : null}
              {isEdit ? "Salvar" : "Criar grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
