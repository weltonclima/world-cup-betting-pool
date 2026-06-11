"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Search, Users } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSearchGroups } from "@/features/groups/hooks";
import type { Pool } from "@/types/pools";

import { GroupNotFound } from "./GroupNotFound";
import { GroupSubHeader } from "./GroupSubHeader";

/**
 * Busca/seleção de grupo (PRD-09, TASK-09 — tela PRD09-03).
 *
 * Lista pools `active` por nome/slug (reusa `useSearchGroups`). Cada item linka
 * para os detalhes (PRD09-05). Estados: loading=skeleton, erro=alerta+retry,
 * vazio=`GroupNotFound` (PRD09-04). Ações secundárias "Não encontrei meu grupo"
 * (foca a busca) / "Criar novo grupo" (→ TASK-08).
 */
export function GroupSearch(): JSX.Element {
  const [term, setTerm] = useState("");
  const { data: groups, isLoading, isError, refetch } = useSearchGroups(term);

  return (
    <div className="flex flex-col gap-5">
      <GroupSubHeader
        title="Selecionar Grupo"
        subtitle="Informe o grupo que você deseja participar"
      />

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
          className="h-11 pl-9"
        />
      </div>

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 text-center"
        >
          <AlertCircle size={28} className="text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os grupos. Tente novamente.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="min-h-[44px]"
          >
            Tentar Novamente
          </Button>
        </div>
      ) : isLoading ? (
        <GroupResultsSkeleton />
      ) : groups && groups.length > 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-foreground">
            Grupos encontrados
          </p>
          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <GroupResultRow group={group} />
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTerm("")}
              className="h-12 w-full text-primary"
            >
              Não encontrei meu grupo
            </Button>
            <Link
              href="/grupos/criar"
              className={cn(
                buttonVariants({ variant: "link" }),
                "h-11 w-full text-primary",
              )}
            >
              Criar novo grupo
            </Link>
          </div>
        </div>
      ) : (
        <GroupNotFound onRetry={() => void refetch()} />
      )}
    </div>
  );
}

/** Linha de resultado: avatar/iniciais + nome + slug + chevron, ≥ 44px de alvo. */
function GroupResultRow({ group }: { group: Pool }): JSX.Element {
  return (
    <Link
      href={`/grupos/${encodeURIComponent(group.id)}`}
      className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted"
    >
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
        {group.photoBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.photoBase64} alt="" className="size-full object-cover" />
        ) : (
          <Users size={18} className="text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">
          {group.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {group.slug}
        </span>
      </span>
      <ChevronRight
        size={20}
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}

/** Skeleton da lista durante a busca. */
function GroupResultsSkeleton(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border p-3"
        >
          <div className="size-11 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3.5 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
