import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Bot, ShoppingBag, MessageSquare, Truck, FileSpreadsheet, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Order Concierge — WhatsApp AI for WooCommerce" },
      { name: "description", content: "An AI agent that confirms WooCommerce orders, answers product questions on WhatsApp, and tracks dispatch via Postex." },
      { property: "og:title", content: "Order Concierge" },
      { property: "og:description", content: "WhatsApp AI for WooCommerce stores in Pakistan." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="w-5 h-5 text-primary" /> Order Concierge
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth">Get started</Link></Button>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium bg-accent text-accent-foreground rounded-full px-3 py-1 mb-6">
          Roman Urdu + English · WhatsApp Business API · WooCommerce
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
          The AI teammate that confirms every order on WhatsApp.
        </h1>
        <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
          When a customer checks out on your WooCommerce store, Order Concierge messages them
          on WhatsApp from your business number, confirms the order, captures the address,
          answers product questions, and pings them when Postex dispatches the parcel.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button asChild size="lg">
            <Link to="/auth">Open the dashboard <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: ShoppingBag, title: "Order captured", text: "WooCommerce webhook lands the order in your dashboard the second it's placed." },
            { icon: FileSpreadsheet, title: "Logged to Sheets", text: "A new row in your client's Google Sheet for the fulfillment team." },
            { icon: MessageSquare, title: "AI confirms on WhatsApp", text: "Bilingual agent confirms, captures the address, and answers product Q&A." },
            { icon: Truck, title: "Postex dispatch alert", text: "Customer gets a tracking message the moment the courier picks up." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5">
                <Icon className="w-5 h-5 text-primary mb-3" />
                <div className="font-medium mb-1">{f.title}</div>
                <div className="text-sm text-muted-foreground">{f.text}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
