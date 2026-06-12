import type { z } from "zod";

import type {
  inviteCreateClientSchema,
  inviteInputSchema,
  inviteSchema,
} from "@/schemas/invites";

export type Invite = z.infer<typeof inviteSchema>;
export type InviteInput = z.infer<typeof inviteInputSchema>;
export type InviteCreateClientInput = z.infer<typeof inviteCreateClientSchema>;
