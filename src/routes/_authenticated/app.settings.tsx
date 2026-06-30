import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingBag, FileSpreadsheet, MessageSquare, Truck, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Order Concierge" }] }),
  component: SettingsPage,
});

const integrations = [
  { icon: ShoppingBag, name: "WooCommerce", desc: "Pushes new orders into the system via webhook", phase: "Phase 2" },
  { icon: FileSpreadsheet, name: "Google Sheets", desc: "Appends a row per order for your fulfillment team", phase: "Phase 2" },
  { icon: MessageSquare, name: "WhatsApp Business", desc: "Sends confirmations and runs the AI conversation", phase: "Phase 3–4" },
  { icon: Truck, name: "Postex", desc: "Notifies the customer when their parcel ships", phase: "Phase 5" },
];

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex gap-2">
        <code className="flex-1 px-3 py-2 rounded-md bg-muted text-xs font-mono truncate">{value}</code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied to clipboard");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SettingsPage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Integrations and project configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook endpoints</CardTitle>
          <CardDescription>
            Give these URLs to WooCommerce and Postex once the client's site is live.
            Both endpoints verify a shared secret — the values are stored securely in this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField
            label="WooCommerce — Order created webhook"
            value={`${origin || "https://your-app.lovable.app"}/api/public/woo-order`}
            hint="In WP admin → WooCommerce → Settings → Advanced → Webhooks. Topic: Order created. Set Secret to the value of WOO_WEBHOOK_SECRET."
          />
          <CopyField
            label="Postex — Dispatch webhook (Phase 5)"
            value={`${origin || "https://your-app.lovable.app"}/api/public/postex-dispatch`}
            hint="We'll wire this up in Phase 5 once Postex is connected."
          />
        </CardContent>
      </Card>

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