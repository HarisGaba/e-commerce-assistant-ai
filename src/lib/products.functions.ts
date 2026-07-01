import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchProducts, getProduct } from "./woo-products.server";

export const searchProductsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string; limit?: number }) =>
    z.object({ query: z.string().default(""), limit: z.number().int().min(1).max(50).default(12) }).parse(d),
  )
  .handler(async ({ data }) => {
    const results = await searchProducts(data.query || "", data.limit);
    return { configured: !!process.env.WOOCOMMERCE_API_KEY, results };
  });

export const getProductFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    return await getProduct(data.id);
  });