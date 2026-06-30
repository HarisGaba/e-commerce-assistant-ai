import { createFileRoute } from "@tanstack/react-router";
import { verifyWooSignature, normalizePhone } from "@/lib/woo-webhook.server";

/**
 * WooCommerce → /api/public/woo-order
 * Configure in WP admin → WooCommerce → Settings → Advanced → Webhooks:
 *   Topic:     Order created
 *   Delivery URL: https://<your-domain>/api/public/woo-order
 *   Secret:    value of WOO_WEBHOOK_SECRET
 *   API ver:   WP REST API Integration v3
 */
export const Route = createFileRoute("/api/public/woo-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WOO_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 500 });
        }

        const rawBody = await request.text();
        const sig = request.headers.get("x-wc-webhook-signature");

        if (!verifyWooSignature(rawBody, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const wooOrderId = Number(payload?.id);
        if (!wooOrderId) return new Response("Missing order id", { status: 400 });

        const billing = payload.billing ?? {};
        const shipping = payload.shipping ?? {};
        const phone = normalizePhone(billing.phone || shipping.phone);
        if (!phone) {
          return new Response("Order missing phone number", { status: 422 });
        }
        const fullName =
          [billing.first_name, billing.last_name].filter(Boolean).join(" ").trim() ||
          [shipping.first_name, shipping.last_name].filter(Boolean).join(" ").trim() ||
          null;
        const address =
          [billing.address_1, billing.address_2].filter(Boolean).join(", ") ||
          [shipping.address_1, shipping.address_2].filter(Boolean).join(", ") ||
          null;
        const city = billing.city || shipping.city || null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: if we already have this woo_order_id, just ACK.
        const existing = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("woo_order_id", wooOrderId)
          .maybeSingle();
        if (existing.data) {
          return Response.json({ ok: true, dedup: true, order_id: existing.data.id });
        }

        // Upsert customer by phone.
        const customerUpsert = await supabaseAdmin
          .from("customers")
          .upsert(
            {
              phone,
              full_name: fullName,
              email: billing.email ?? null,
              address,
              city,
            },
            { onConflict: "phone" },
          )
          .select("id")
          .single();
        if (customerUpsert.error) {
          console.error("[woo-order] customer upsert failed", customerUpsert.error);
          return new Response("DB error (customer)", { status: 500 });
        }
        const customerId = customerUpsert.data.id;

        const orderInsert = await supabaseAdmin
          .from("orders")
          .insert({
            woo_order_id: wooOrderId,
            customer_id: customerId,
            status: "received",
            total: Number(payload.total ?? 0),
            currency: payload.currency ?? "PKR",
            shipping_address: [address, city].filter(Boolean).join(", ") || null,
            payment_method: payload.payment_method_title ?? payload.payment_method ?? null,
            raw_woo: payload,
          })
          .select("id")
          .single();
        if (orderInsert.error) {
          console.error("[woo-order] order insert failed", orderInsert.error);
          return new Response("DB error (order)", { status: 500 });
        }
        const orderId = orderInsert.data.id;

        const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
        if (lineItems.length > 0) {
          const rows = lineItems.map((li: any) => ({
            order_id: orderId,
            woo_product_id: li.product_id ?? null,
            product_name: li.name ?? "Unknown product",
            variation: li.variation_id ? String(li.variation_id) : null,
            quantity: Number(li.quantity ?? 1),
            unit_price: li.price != null ? Number(li.price) : null,
            line_total: li.total != null ? Number(li.total) : null,
          }));
          const itemsInsert = await supabaseAdmin.from("order_items").insert(rows);
          if (itemsInsert.error) {
            console.error("[woo-order] order_items insert failed", itemsInsert.error);
          }
        }

        // Append to Google Sheet (best-effort; skipped if not configured yet).
        try {
          const { appendOrderRow } = await import("@/lib/sheets.server");
          const itemsSummary = lineItems
            .map((li: any) => `${li.quantity}x ${li.name}`)
            .join("; ");
          const sheetResult = await appendOrderRow({
            wooOrderId,
            customerName: fullName,
            phone,
            items: itemsSummary,
            total: payload.total,
            currency: payload.currency,
            address,
            city,
            paymentMethod: payload.payment_method_title ?? payload.payment_method ?? null,
            status: "received",
          });
          if (sheetResult.skipped) {
            console.log("[woo-order] sheet append skipped:", sheetResult.reason);
          }
        } catch (e) {
          console.error("[woo-order] sheet append error", (e as Error).message);
        }

        // Send the AI confirmation opener over WhatsApp (best-effort).
        try {
          const { sendWhatsAppText } = await import("@/lib/whatsapp.server");
          const { buildOrderConfirmationOpener } = await import("@/lib/ai-agent.server");
          const opener = buildOrderConfirmationOpener({
            customerName: fullName,
            wooOrderId,
            items: lineItems.map((li: any) => ({ name: li.name, quantity: Number(li.quantity ?? 1) })),
            total: payload.total != null ? Number(payload.total) : null,
            currency: payload.currency ?? "PKR",
            address: [address, city].filter(Boolean).join(", ") || null,
          });
          const sent = await sendWhatsAppText(phone, opener);

          // Create conversation + log the outbound opener so the dashboard shows it.
          const convIns = await supabaseAdmin
            .from("conversations")
            .upsert(
              { customer_id: customerId, order_id: orderId, mode: "ai" },
              { onConflict: "customer_id" },
            )
            .select("id")
            .single();
          if (convIns.data) {
            await supabaseAdmin.from("messages").insert({
              conversation_id: convIns.data.id,
              direction: "outbound",
              role: "ai",
              body: opener,
              whatsapp_message_id: sent.messageId ?? null,
              error: sent.skipped ? sent.reason ?? "WhatsApp not configured" : null,
            });
          }
        } catch (e) {
          console.error("[woo-order] WA opener failed", (e as Error).message);
        }

        return Response.json({ ok: true, order_id: orderId });
      },
    },
  },
});