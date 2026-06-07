"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useUserStatusCounts } from "../hooks/useUsers";

import { UserStatusList } from "./UserStatusList";

/** Painel admin (telas 03/05): header + tabs por status + lista por tab. */
export function UsersPanel() {
  const counts = useUserStatusCounts();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
      </header>

      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTab value="pending">
            Pendentes <Badge variant="secondary">{counts.pending}</Badge>
          </TabsTab>
          <TabsTab value="approved">
            Aprovados <Badge variant="secondary">{counts.approved}</Badge>
          </TabsTab>
          <TabsTab value="blocked">
            Bloqueados <Badge variant="destructive">{counts.blocked}</Badge>
          </TabsTab>
        </TabsList>

        <TabsPanel value="pending">
          <UserStatusList status="pending" />
        </TabsPanel>
        <TabsPanel value="approved">
          <UserStatusList status="approved" />
        </TabsPanel>
        <TabsPanel value="blocked">
          <UserStatusList status="blocked" />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
