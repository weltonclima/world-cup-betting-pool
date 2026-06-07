import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface UserListErrorProps {
  onRetry: () => void;
}

/** Estado de erro da lista, com ação de retry. */
export function UserListError({ onRetry }: UserListErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground"
    >
      <TriangleAlert size={24} aria-hidden="true" className="text-destructive" />
      <p className="text-sm">Não foi possível carregar os usuários.</p>
      <Button variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
