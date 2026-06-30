import { createFileRoute } from "@tanstack/react-router";
import {
  verifyMetaSignature,
  normalizeIncomingPhone,
  sendWhatsAppText,
} from "@/lib/whatsapp.server";
import { runConversationTurn } from "@/lib/ai-agent.server";

/**
 * Meta WhatsApp Cloud webhook.
 *   GET  – verification handshake (hub.challenge)
 *   POST – inbound message events (signature verified, then handed to AI agent)
 */
export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.WHATSAPP_VERIFY_TOKEN;
        if (mode === "subscribe" && token && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        if (!verifyMetaSignature(rawBody, sig)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // ACK Meta immediately; do real work in background.
        // (TanStack handler must return — we await but keep it fast.)
        try {
          await handleInbound(payload);
        } catch (e) {
          console.error("[whatsapp] handler error", (e as Error).message);
        }
        return Response.json({ ok: true });
      },
    },
  },
});

async function handleInbound(payload: any) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      for (const msg of messages) {
        if (msg.type !== "text") continue; // Phase 3 = text only
        const body = msg?.text?.body as string | undefined;
        if (!body) continue;
        const waId = msg.from as string;
        const phone = normalizeIncomingPhone(waId);
        if (!phone) continue;
        const contactName: string | null =
          contacts.find((c: any) => c.wa_id === waId)?.profile?.name ?? null;
        await processCustomerMessage(phone, contactName, body, msg.id);
      }
    }
  }
}

async function processCustomerMessage(
  phone: string,
  contactName: string | null,
  text: string,
  waMessageId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Upsert customer
  const customerUp = await supabaseAdmin
    .from("customers")
    .upsert({ phone, full_name: contactName ?? undefined }, { onConflict: "phone" })
    .select("id, full_name, address, city")
    .single();
  if (customerUp.error) {
    console.error("[whatsapp] customer upsert failed", customerUp.error);
    return;
  }
  const customer = customerUp.data;

  // 2. Find most recent order for this customer (for context)
  const orderRes = await supabaseAdmin
    .from("orders")
    .select("id, woo_order_id, status, total, currency, shipping_address")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const order = orderRes.data;

  let recentOrder = null as null | {
    wooOrderId: number | null;
    items: { name: string; quantity: number; price: number | null }[];
    total: number | null;
    currency: string | null;
    address: string | null;
    city: string | null;
  };
  if (order) {
    const itemsRes = await supabaseAdmin
      .from("order_items")
      .select("product_name, quantity, unit_price")
      .eq("order_id", order.id);
    recentOrder = {
      wooOrderId: order.woo_order_id,
      items: (itemsRes.data ?? []).map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        price: i.unit_price,
      })),
      total: order.total,
      currency: order.currency,
      address: order.shipping_address,
      city: customer.city,
    };
  }

  // 3. Get-or-create conversation tied to customer (+ latest order if any)
  let conv = await supabaseAdmin
    .from("conversations")
    .select("id, mode, order_id")
    .eq("customer_id", customer.id)
    .maybeSingle();
  let conversationId: string;
  if (conv.data) {
    conversationId = conv.data.id;
    if (order && conv.data.order_id !== order.id) {
      await supabaseAdmin.from("conversations").update({ order_id: order.id }).eq("id", conversationId);
    }
  } else {
    const ins = await supabaseAdmin
      .from("conversations")
      .insert({ customer_id: customer.id, order_id: order?.id ?? null, mode: "ai" })
      .select("id, mode")
      .single();
    if (ins.error) {
      console.error("[whatsapp] conv insert failed", ins.error);
      return;
    }
    conversationId = ins.data.id;
    conv = { data: ins.data, error: null } as any;
  }

  // 4. Log inbound message
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    role: "customer",
    body: text,
    whatsapp_message_id: waMessageId,
  });

  // If a human took over, do not auto-reply
  if (conv.data?.mode === "human") {
    return;
  }

  // 5. Load recent history (last 20 messages)
  const histRes = await supabaseAdmin
    .from("messages")
    .select("role, body, direction, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);
  const history = (histRes.data ?? [])
    .reverse()
    .filter((m) => m.role === "customer" || m.role === "ai")
    .slice(0, -1) // exclude the just-inserted inbound (we pass it separately)
    .map((m) => ({
      role: (m.role === "customer" ? "user" : "assistant") as "user" | "assistant",
      content: m.body,
    }));

  // 6. Run AI
  const agentResult = await runConversationTurn(text, {
    customerName: customer.full_name,
    phone,
    recentOrder,
    history,
  });

  // 7. Send reply
  let sendErr: string | null = null;
  let outboundId: string | null = null;
  try {
    const sent = await sendWhatsAppText(phone, agentResult.reply);
    outboundId = sent.messageId ?? null;
    if (sent.skipped) sendErr = sent.reason ?? "WhatsApp not configured";
  } catch (e) {
    sendErr = (e as Error).message;
  }

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    role: "ai",
    body: agentResult.reply,
    whatsapp_message_id: outboundId,
    error: sendErr,
  });

  await supabaseAdmin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // 8. Update order status on confirmation/cancellation
  if (order && agentResult.orderConfirmed) {
    await supabaseAdmin.from("orders").update({ status: "confirmed" }).eq("id", order.id);
    try {
      const { updateOrderStatusInSheet } = await import("@/lib/sheets.server");
      if (order.woo_order_id) await updateOrderStatusInSheet(order.woo_order_id, "confirmed");
    } catch {}
  } else if (order && agentResult.orderCancelled) {
    await supabaseAdmin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    try {
      const { updateOrderStatusInSheet } = await import("@/lib/sheets.server");
      if (order.woo_order_id) await updateOrderStatusInSheet(order.woo_order_id, "cancelled");
    } catch {}
  }
}