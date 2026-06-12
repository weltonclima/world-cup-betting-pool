"use client";

import { useMemo, useState, type JSX } from "react";
import { LoaderCircle } from "lucide-react";

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
import { useAdminGroups } from "@/features/superAdmin/hooks";

import { SearchInput, GroupAvatar } from "./shared";

/**
 * Diálogo de seleção do grupo de destino ao adicionar/realocar um usuário (tela
 * "Usuários sem grupo"). Lista os grupos `active` (lazy: só busca quando aberto) e
 * dispara a atribuição com o slug/id selecionado. Controlado; o pai fecha no
 * sucesso.
 */
export function AssignGroupDialog({
  open,
  onOpenChange,
  userName,
  currentGroupId,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  currentGroupId?: string | null;
  pending: boolean;
  onConfirm: (groupId: string) => void;
}): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useAdminGroups("active");

  const filtered = useMemo(() => {
    if (!data) return undefined;
    const q = search.trim().toLowerCase();
    const base = q
      ? data.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.slug.toLowerCase().includes(q),
        )
      : data;
    return base;
  }, [data, search]);

  function reset(): void {
    setSelected(null);
    setSearch("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Adicionar a um grupo</DialogTitle>
          <DialogDescription>
            Escolha o grupo de destino para {userName}.
          </DialogDescription>
        </DialogHeader>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou slug"
        />

        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div
              role="status"
              aria-busy="true"
              aria-label="Carregando grupos"
              className="flex flex-col gap-2"
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="h-12 rounded-lg bg-muted animate-pulse motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : isError ? (
            <div role="alert" className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-muted-foreground">Erro ao carregar grupos.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                className="min-h-[44px]"
              >
                Tentar novamente
              </Button>
            </div>
          ) : (filtered ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum grupo ativo disponível.
            </p>
          ) : (
            <ul className="flex flex-col gap-1" role="radiogroup" aria-label="Selecionar grupo">
              {(filtered ?? []).map((g) => {
                const active = selected === g.id;
                const isCurrent = currentGroupId === g.id;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={pending || isCurrent}
                      onClick={() => setSelected(g.id)}
                      className={`flex min-h-[48px] w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      <GroupAvatar name={g.name} photoBase64={g.photoBase64} className="size-8" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{g.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {isCurrent ? "Grupo atual" : g.slug}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={
              <Button variant="outline" className="h-11">
                Cancelar
              </Button>
            }
          />
          <Button
            className="h-11"
            disabled={pending || selected === null}
            aria-busy={pending}
            onClick={() => selected && onConfirm(selected)}
          >
            {pending ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
