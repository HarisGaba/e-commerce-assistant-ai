// Server-only helper for appending order rows to the client's Google Sheet.
// Uses the Lovable connector gateway. The Google Sheets connection is linked later;
// until then this helper short-circuits without throwing.

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_sheets/v4";
const DEFAULT_TAB = "Orders";
const HEADER = [
  "Timestamp",
  "Order #",
  "Customer",
  "Phone",
  "Items",
  "Total",
  "Currency",
  "Address",
  "City",
  "Payment",
  "Status",
  "Tracking",
];

export type SheetOrderRow = {
  wooOrderId: number | string | null;
  customerName: string | null;
  phone: string | null;
  items: string;
  total: number | string | null;
  currency: string | null;
  address: string | null;
  city: string | null;
  paymentMethod: string | null;
  status: string;
  trackingId?: string | null;
};

function getCreds() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!lovableKey || !sheetsKey || !sheetId) {
    return null;
  }
  return { lovableKey, sheetsKey, sheetId, tab: process.env.GOOGLE_SHEET_TAB || DEFAULT_TAB };
}

async function sheetsFetch(path: string, init: RequestInit, creds: NonNullable<ReturnType<typeof getCreds>>) {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${creds.lovableKey}`,
      "X-Connection-Api-Key": creds.sheetsKey,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function appendOrderRow(row: SheetOrderRow): Promise<{ skipped: boolean; reason?: string }> {
  const creds = getCreds();
  if (!creds) {
    return { skipped: true, reason: "Google Sheets not configured yet" };
  }

  const values = [[
    new Date().toISOString(),
    String(row.wooOrderId ?? ""),
    row.customerName ?? "",
    row.phone ?? "",
    row.items,
    row.total != null ? String(row.total) : "",
    row.currency ?? "",
    row.address ?? "",
    row.city ?? "",
    row.paymentMethod ?? "",
    row.status,
    row.trackingId ?? "",
  ]];

  // Best-effort: ensure header row exists. Ignore failures (e.g. missing tab).
  try {
    const meta = await sheetsFetch(
      `/spreadsheets/${creds.sheetId}/values/${creds.tab}!A1:L1`,
      { method: "GET" },
      creds,
    );
    if (!meta?.values || meta.values.length === 0) {
      await sheetsFetch(
        `/spreadsheets/${creds.sheetId}/values/${creds.tab}!A1:L1?valueInputOption=USER_ENTERED`,
        { method: "PUT", body: JSON.stringify({ values: [HEADER] }) },
        creds,
      );
    }
  } catch (e) {
    console.warn("[sheets] header check failed:", (e as Error).message);
  }

  await sheetsFetch(
    `/spreadsheets/${creds.sheetId}/values/${creds.tab}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
    creds,
  );

  return { skipped: false };
}

export async function updateOrderStatusInSheet(
  wooOrderId: number | string,
  status: string,
  trackingId?: string | null,
): Promise<{ skipped: boolean }> {
  const creds = getCreds();
  if (!creds) return { skipped: true };

  // Find row by Order # column (B). Scan first 1000 rows.
  try {
    const data = await sheetsFetch(
      `/spreadsheets/${creds.sheetId}/values/${creds.tab}!B2:B1000`,
      { method: "GET" },
      creds,
    );
    const rows: string[][] = data?.values ?? [];
    const idx = rows.findIndex((r) => String(r?.[0] ?? "") === String(wooOrderId));
    if (idx < 0) return { skipped: true };
    const rowNumber = idx + 2;
    await sheetsFetch(
      `/spreadsheets/${creds.sheetId}/values/${creds.tab}!K${rowNumber}:L${rowNumber}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [[status, trackingId ?? ""]] }) },
      creds,
    );
    return { skipped: false };
  } catch (e) {
    console.warn("[sheets] status update failed:", (e as Error).message);
    return { skipped: true };
  }
}