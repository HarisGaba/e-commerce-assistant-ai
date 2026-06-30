import { createHmac, timingSafeEqual } from "crypto";

/**
 * Meta WhatsApp Cloud API helper.
 * Required env (set at the end of the build):
 *   WHATSAPP_PHONE_NUMBER_ID  – the Cloud API phone number ID (digits)
 *   WHATSAPP_ACCESS_TOKEN     – permanent system-user access token
 *   WHATSAPP_APP_SECRET       – app secret used to verify X-Hub-Signature-256
 *   WHATSAPP_VERIFY_TOKEN     – matches the value set in the webhook config
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<{ skipped: boolean; messageId?: string; reason?: string }> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    return { skipped: true, reason: "WhatsApp not configured yet" };
  }
  const cleanTo = to.replace(/^\+/, "");
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp send failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  const messageId = json?.messages?.[0]?.id as string | undefined;
  return { skipped: false, messageId };
}

/**
 * Meta signs every webhook POST with HMAC-SHA256(app_secret, rawBody)
 * in the X-Hub-Signature-256 header, formatted as "sha256=<hex>".
 */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    // If app secret isn't set yet, skip verification in dev (warned in logs).
    console.warn("[whatsapp] WHATSAPP_APP_SECRET not set; skipping signature check");
    return true;
  }
  if (!header || !header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function normalizeIncomingPhone(waId: string | undefined | null): string | null {
  if (!waId) return null;
  const digits = waId.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `+${digits}`;
}