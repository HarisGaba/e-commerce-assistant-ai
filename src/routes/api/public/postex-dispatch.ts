import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { sendWhatsAppText } from "@/lib/whatsapp.server";
import { updateOrderStatusInSheet } from "@/lib/sheets.server";

/**
 * Postex dispatch webhook.
 *   Header: X-Postex-Signature = HMAC-SHA256(POSTEX_WEBHOOK_SECRET, rawBody) hex
 *   Body:   { order_reference: <woo_order_id>, tracking_id, status, tracking_url? }
 *
 * Postex itself does not natively sign webhooks, so we treat this endpoint
 * as "any caller that knows the shared secret" (via signature). When wiring
 * Postex at the end, configure either:
 *   - a Postex automation/webhook with a signing step, OR
 *   - a Zapier/Make middleman that signs the body with the same secret.
 */
export const Route = createFileRoute("/api/public/postex-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.POSTEX_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });

        const raw = await request.text();
        const sig = request.headers.get("x-postex-signature");
        if (!sig) return new Response("Missing signature", { status: 401 });
        const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const wooOrderId = Number(payload?.order_reference ?? payload?.woo_order_id);
        const trackingId = String(payload?.tracking_id ?? payload?.trackingNumber ?? "").trim();
        const trackingUrl = (payload?.tracking_url ?? null) as string | null;
        if (!wooOrderId || !trackingId) {
          return new Response("Missing order_reference or tracking_id", { status: 422 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const orderRes = await supabaseAdmin
          .from("orders")
          .select("id, customer_id, woo_order_id")
          .eq("woo_order_id", wooOrderId)
          .maybeSingle();
        if (!orderRes.data) {
          return new Response("Unknown order", { status: 404 });
        }
        const order = orderRes.data;

        await supabaseAdmin
          .from("orders")
          .update({
            status: "dispatched",
            tracking_id: trackingId,
            dispatched_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        const custRes = await supabaseAdmin
          .from("customers")
          .select("phone, full_name")
          .eq("id", order.customer_id)
          .single();
        const phone = custRes.data?.phone;
        const firstName = custRes.data?.full_name?.split(" ")[0] ?? "";

        if (phone) {
          const lines = [
            `Khushkhabri${firstName ? " " + firstName : ""}! 📦`,
            `Aap ka order #${wooOrderId} dispatch ho gaya hai.`,
            `Tracking ID: ${trackingId}`,
            trackingUrl ? `Track: ${trackingUrl}` : "",
            "",
            "Shukriya khareedari ke liye!",
          ].filter(Boolean);
          try {
            await sendWhatsAppText(phone, lines.join("\n"));
          } catch (e) {
            console.error("[postex] WA send failed", (e as Error).message);
          }
        }

        try {
          await updateOrderStatusInSheet(wooOrderId, "dispatched", trackingId);
        } catch {}

        return Response.json({ ok: true });
      },
    },
  },
});