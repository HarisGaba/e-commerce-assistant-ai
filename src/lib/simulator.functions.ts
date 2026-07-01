import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runConversationTurn, type AgentContext } from "./ai-agent.server";

const historyItem = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const simulateReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        message: z.string().min(1).max(2000),
        history: z.array(historyItem).max(30).default([]),
        customerName: z.string().nullable().optional(),
        phone: z.string().default("+920000000000"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx: AgentContext = {
      customerName: data.customerName ?? "Test Customer",
      phone: data.phone,
      recentOrder: null,
      history: data.history,
    };
    const res = await runConversationTurn(data.message, ctx);
    return res;
  });