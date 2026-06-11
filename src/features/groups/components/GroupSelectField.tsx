"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { AlertCircle, Check, Search, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useSearchGroups } from "@/features/groups/hooks";
import type { Pool } from "@/types/pools";

/**
 * Campo de seleção de grupo embutido no cadastro (PRD-09, TASK-07 — tela
 * PRD09-03 condensada). Busca pools `active` por nome/slug (reusa `useSearchGroups`)
 * e devolve o `id` do pool escolhido via `onChange`. O valor controlado é o
 * `groupId` do RHF; o termo digitado é estado local.
 *
 * Acessibilidade: input rotulado, lista com `role="listbox"`, opções como botões
 * com `aria-selected`; alvos ≥ 44px. Estados loading/erro/vazio anunciados.
 */
interface GroupSelectFieldProps {
  /** `groupId` atualmente selecionado ("" = nenhum). */
  value: string;
  /** Notifica o id do pool escolhido (ou "" ao limpar). */
  onChange: (groupId: string) => void;
  /** Marca o campo como inválido (aria-invalid) — controlado pelo form. */
  invalid?: boolean;
}

export function GroupSelectField({
  value,
  onChange,
  invalid = false,
}: GroupSelectFieldProps): JSX.Element {
  const [term, setTerm] = useState("");
  const { data: groups, isLoading, isError, refetch } = useSearchGroups(term);

  const selected = groups?.find((g) => g.id === value) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar grupo por nome ou slug"
          aria-label="Buscar grupo por nome ou slug"
          aria-required="true"
          aria-invalid={invalid}
          className="h-11 pl-9"
        />
      </div>

      {/* Grupo selecionado — confirmação compacta */}
      {selected ? (
        <p
          className="flex items-center gap-1.5 text-sm text-primary"
          aria-live="polite"
        >
          <Check size={16} aria-hidden="true" />
          <span>
            Grupo selecionado: <strong>{selected.name}</strong>
          </span>
        </p>
      ) : null}

      {/* Estado de erro de busca */}
      {isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle size={16} className="text-destructive" aria-hidden="true" />
            Não foi possível buscar os grupos.
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="min-h-[44px] font-medium text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {/* Lista de resultados */}
      {!isError ? (
        <div
          role="listbox"
          aria-label="Grupos encontrados"
          aria-busy={isLoading}
          className="flex max-h-64 flex-col gap-2 overflow-y-auto"
        >
          {isLoading ? (
            <GroupOptionSkeleton />
          ) : groups && groups.length > 0 ? (
            groups.map((group) => (
              <GroupOption
                key={group.id}
                group={group}
                selected={group.id === value}
                onSelect={() => onChange(group.id)}
              />
            ))
          ) : (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Nenhum grupo encontrado.{" "}
              <Link
                href="/grupos/criar"
                className="font-medium text-primary hover:underline"
              >
                Criar novo grupo
              </Link>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Opção da lista — botão de alvo ≥ 44px com nome, slug e nº de membros. */
function GroupOption({
  group,
  selected,
  onSelect,
}: {
  group: Pool;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex min-h-[44px] items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted"
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
        {group.photoBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.photoBase64}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <Users size={16} className="text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {group.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {group.slug}
        </span>
      </span>
      {selected ? (
        <Check size={18} className="shrink-0 text-primary" aria-hidden="true" />
      ) : null}
    </button>
  );
}

/** Skeleton de uma opção durante a busca. */
function GroupOptionSkeleton(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[44px] items-center gap-3 rounded-lg border border-border p-3"
    >
      <div className="size-9 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-3.5 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}
