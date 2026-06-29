import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingBag, FileSpreadsheet, MessageSquare, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Order Concierge" }] }),
  component: SettingsPage,
});

const integrations = [
  { icon: ShoppingBag, name: "WooCommerce", desc: "Pulls new orders + product data from your store", phase: "Phase 2" },
  { icon: FileSpreadsheet, name: "Google Sheets", desc: "Appends a row per order for your fulfillment team", phase: "Phase 2" },
  { icon: MessageSquare, name: "WhatsApp Business", desc: "Sends confirmations and runs the AI conversation", phase: "Phase 3–4" },
  { icon: Truck, name: "Postex", desc: "Notifies the customer when their parcel ships", phase: "Phase 5" },
];

function SettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Integrations and project configuration.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((i) => {
          const Icon = i.icon;
          return (
            <Card key={i.name}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-5 h-5 text-primary" />
                  {i.name}
                  <Badge variant="outline" className="ml-auto text-xs">{i.phase}</Badge>
                </CardTitle>
                <CardDescription>{i.desc}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Not connected yet.
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}