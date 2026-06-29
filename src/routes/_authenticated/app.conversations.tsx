import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/conversations")({
  head: () => ({ meta: [{ title: "Conversations — Order Concierge" }] }),
  component: () => (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">WhatsApp threads handled by the AI agent.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />Coming in Phase 4</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Once WhatsApp is connected, every customer thread will appear here with a live transcript,
          AI/human mode toggle, and a manual takeover button.
        </CardContent>
      </Card>
    </div>
  ),
});