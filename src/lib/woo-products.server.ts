/**
 * Server-only WooCommerce product lookups via the Lovable connector gateway.
 * The WooCommerce connection is linked at the end of the build; until then
 * these helpers return null safely so the AI agent can still respond.
 */
const GATEWAY = "https://connector-gateway.lovable.dev/woocommerce";

export type ProductSummary = {
  id: number;
  name: string;
  price: string | null;
  sale_price: string | null;
  stock_status: string | null;
  short_description: string | null;
  permalink: string | null;
  categories: string[];
};

function getCreds() {
  const lovable = process.env.LOVABLE_API_KEY;
  const woo = process.env.WOOCOMMERCE_API_KEY;
  if (!lovable || !woo) return null;
  return { lovable, woo };
}

function strip(html: string | null | undefined): string | null {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
}

function summarize(p: any): ProductSummary {
  return {
    id: Number(p.id),
    name: String(p.name ?? ""),
    price: p.price ?? null,
    sale_price: p.sale_price || null,
    stock_status: p.stock_status ?? null,
    short_description: strip(p.short_description) ?? strip(p.description),
    permalink: p.permalink ?? null,
    categories: Array.isArray(p.categories) ? p.categories.map((c: any) => c.name).filter(Boolean) : [],
  };
}

async function wooFetch(path: string, creds: NonNullable<ReturnType<typeof getCreds>>) {
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: {
      Authorization: `Bearer ${creds.lovable}`,
      "X-Connection-Api-Key": creds.woo,
    },
  });
  if (!res.ok) {
    throw new Error(`Woo ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function searchProducts(query: string, limit = 5): Promise<ProductSummary[]> {
  const creds = getCreds();
  if (!creds) return [];
  try {
    const data = await wooFetch(
      `/products?search=${encodeURIComponent(query)}&per_page=${limit}&status=publish`,
      creds,
    );
    return Array.isArray(data) ? data.map(summarize) : [];
  } catch (e) {
    console.warn("[woo] search failed:", (e as Error).message);
    return [];
  }
}

export async function getProduct(id: number): Promise<ProductSummary | null> {
  const creds = getCreds();
  if (!creds) return null;
  try {
    const data = await wooFetch(`/products/${id}`, creds);
    return summarize(data);
  } catch (e) {
    console.warn("[woo] get failed:", (e as Error).message);
    return null;
  }
}