import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/orders")({
  head: () => ({ meta: [{ title: "Orders — Order Concierge" }] }),
  component: OrdersPage,
});

const statusColor: Record<string, string> = {
  received: "bg-muted text-muted-foreground",
  awaiting_confirm: "bg-warning/20 text-warning",
  confirmed: "bg-primary/15 text-primary",
  address_pending: "bg-warning/20 text-warning",
  ready_to_ship: "bg-primary/15 text-primary",
  dispatched: "bg-primary text-primary-foreground",
  delivered: "bg-success/20 text-success",
  cancelled: "bg-destructive/15 text-destructive",
  needs_human: "bg-destructive/15 text-destructive",
};

function OrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, woo_order_id, status, total, currency, created_at, customer:customers(full_name, phone)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Most recent first.</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && (!orders || orders.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                No orders yet. Once you connect WooCommerce and a customer places an order, it'll appear here.
              </TableCell></TableRow>
            )}
            {orders?.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">#{o.woo_order_id ?? o.id.slice(0, 6)}</TableCell>
                <TableCell>
                  <div>{o.customer?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{o.customer?.phone}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColor[o.status] ?? ""}>{o.status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell>{o.currency} {Number(o.total ?? 0).toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{format(new Date(o.created_at), "d MMM, HH:mm")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}