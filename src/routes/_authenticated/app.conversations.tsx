import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, User, Bot, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/conversations")({
  head: () => ({ meta: [{ title: "Conversations — Order Concierge" }] }),
  component: ConversationsPage,
});

type ConvRow = {
  id: string;
  mode: "ai" | "human";
  last_message_at: string | null;
  customers: { full_name: string | null; phone: string } | null;
  orders: { woo_order_id: number | null; status: string } | null;
};

type Msg = {
  id: string;
  body: string;
  role: "ai" | "customer" | "human" | "system";
  direction: "inbound" | "outbound";
  created_at: string;
  error: string | null;
};

function ConversationsPage() {
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("conversations")
      .select("id, mode, last_message_at, customers(full_name, phone), orders(woo_order_id, status)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);
    setConvs((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, body, role, direction, created_at, error")
        .eq("conversation_id", selected)
        .order("created_at", { ascending: true });
      setMessages((data as any) ?? []);
    })();
  }, [selected]);

  const selectedConv = useMemo(() => convs.find((c) => c.id === selected), [convs, selected]);

  const toggleMode = async () => {
    if (!selectedConv) return;
    const next = selectedConv.mode === "ai" ? "human" : "ai";
    await supabase.from("conversations").update({ mode: next }).eq("id", selectedConv.id);
    load();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground mt-1">WhatsApp threads handled by the AI agent.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Threads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
            {!loading && convs.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                No conversations yet. They appear here automatically when WhatsApp is wired up.
              </div>
            )}
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition ${selected === c.id ? "bg-muted" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {c.customers?.full_name || c.customers?.phone || "Unknown"}
                  </span>
                  <Badge variant={c.mode === "ai" ? "default" : "secondary"} className="text-[10px]">
                    {c.mode === "ai" ? "AI" : "Human"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.orders?.woo_order_id ? `#${c.orders.woo_order_id} · ${c.orders.status}` : c.customers?.phone}
                </div>
                {c.last_message_at && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              {selectedConv
                ? selectedConv.customers?.full_name || selectedConv.customers?.phone || "Conversation"
                : "Select a thread"}
            </CardTitle>
            {selectedConv && (
              <Button variant="outline" size="sm" onClick={toggleMode}>
                {selectedConv.mode === "ai" ? "Take over (Human)" : "Hand back to AI"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto bg-muted/20">
            {!selectedConv && (
              <div className="text-sm text-muted-foreground py-12 text-center">
                Pick a thread on the left to view the transcript.
              </div>
            )}
            {selectedConv &&
              messages.map((m) => {
                const isCustomer = m.direction === "inbound";
                return (
                  <div key={m.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${isCustomer ? "bg-white border" : "bg-primary text-primary-foreground"}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] opacity-70 mb-1">
                        {isCustomer ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                        {new Date(m.created_at).toLocaleString()}
                        {m.error && <span className="text-destructive">· {m.error}</span>}
                      </div>
                      {m.body}
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}