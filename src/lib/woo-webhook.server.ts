import { createHmac, timingSafeEqual } from "crypto";

/**
 * WooCommerce signs webhooks with HMAC-SHA256 over the raw request body,
 * keyed with the "Secret" field set in WooCommerce → Settings → Advanced → Webhooks.
 * The signature is sent in the X-WC-Webhook-Signature header as base64.
 */
export function verifyWooSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  // Pakistani local format: 03XXXXXXXXX -> +923XXXXXXXXX
  if (digits.startsWith("0") && digits.length === 11) return `+92${digits.slice(1)}`;
  if (digits.startsWith("92")) return `+${digits}`;
  return `+${digits}`;
}