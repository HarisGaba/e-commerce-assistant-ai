import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, ExternalLink } from "lucide-react";
import { searchProductsFn } from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/app/products")({
  head: () => ({ meta: [{ title: "Products — Order Concierge" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const [query, setQuery] = useState("");
  const search = useServerFn(searchProductsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["woo-products", query],
    queryFn: () => search({ data: { query, limit: 24 } }),
  });

  const results = data?.results ?? [];
  const configured = data?.configured ?? false;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live catalog from WooCommerce. The AI uses these same lookups when replying to customers.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {!configured && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground flex items-center gap-3">
            <Package className="w-5 h-5" />
            WooCommerce is not connected yet. Once the client's store is linked, products will appear here live.
          </CardContent>
        </Card>
      )}

      {configured && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading && (
            <div className="col-span-full text-sm text-muted-foreground">Loading…</div>
          )}
          {!isLoading && results.length === 0 && (
            <div className="col-span-full text-sm text-muted-foreground">No products match this search.</div>
          )}
          {results.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm">{p.name}</h3>
                  <Badge
                    variant="secondary"
                    className={p.stock_status === "instock" ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}
                  >
                    {p.stock_status ?? "?"}
                  </Badge>
                </div>
                <div className="text-sm">
                  {p.sale_price && p.sale_price !== p.price ? (
                    <>
                      <span className="font-semibold">{p.sale_price}</span>
                      <span className="line-through text-muted-foreground ml-2 text-xs">{p.price}</span>
                    </>
                  ) : (
                    <span className="font-semibold">{p.price ?? "—"}</span>
                  )}
                </div>
                {p.short_description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{p.short_description}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1 flex-wrap">
                    {p.categories.slice(0, 2).map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                  {p.permalink && (
                    <a href={p.permalink} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground pt-1">ID: {p.id}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}