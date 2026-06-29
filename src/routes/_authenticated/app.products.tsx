import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/products")({
  head: () => ({ meta: [{ title: "Products — Order Concierge" }] }),
  component: () => (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-sm text-muted-foreground mt-1">Catalog the AI uses when answering customer questions.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Coming in Phase 2</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          After WooCommerce is connected, products will sync here and the AI will look them up live to
          answer price, stock, and description questions accurately.
        </CardContent>
      </Card>
    </div>
  ),
});