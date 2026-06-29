import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, MessageSquare, CheckCircle2, Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Overview — Order Concierge" }] }),
  component: Overview,
});

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: typeof ShoppingBag; hint?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Overview() {
  const { data } = useQuery({
    queryKey: ["overview-stats"],
    queryFn: async () => {
      const [orders, dispatched, confirmed, convs] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "dispatched"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase.from("conversations").select("*", { count: "exact", head: true }),
      ]);
      return {
        orders: orders.count ?? 0,
        dispatched: dispatched.count ?? 0,
        confirmed: confirmed.count ?? 0,
        conversations: convs.count ?? 0,
      };
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live snapshot of your WhatsApp order automation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total orders" value={data?.orders ?? "—"} icon={ShoppingBag} />
        <StatCard label="Confirmed" value={data?.confirmed ?? "—"} icon={CheckCircle2} hint="Customer said yes on WhatsApp" />
        <StatCard label="Dispatched" value={data?.dispatched ?? "—"} icon={Truck} hint="Shipped via Postex" />
        <StatCard label="Conversations" value={data?.conversations ?? "—"} icon={MessageSquare} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Step n={1} done={false} text="Connect your WooCommerce store (Settings → Integrations)" />
          <Step n={2} done={false} text="Connect Google Sheets to log orders" />
          <Step n={3} done={false} text="Configure WhatsApp Business credentials" />
          <Step n={4} done={false} text="Add the Postex dispatch webhook in your Postex panel" />
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ n, done, text }: { n: number; done: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={"w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium " + (done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {n}
      </div>
      <span className={done ? "text-muted-foreground line-through" : ""}>{text}</span>
    </div>
  );
}