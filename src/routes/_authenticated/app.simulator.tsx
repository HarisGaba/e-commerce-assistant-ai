import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, RotateCcw, Loader2 } from "lucide-react";
import { simulateReplyFn } from "@/lib/simulator.functions";

export const Route = createFileRoute("/_authenticated/app/simulator")({
  head: () => ({ meta: [{ title: "AI Simulator — Order Concierge" }] }),
  component: SimulatorPage,
});

type Msg = { role: "user" | "assistant"; content: string; tags?: string[] };

function SimulatorPage() {
  const simulate = useServerFn(simulateReplyFn);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextHistory: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setLoading(true);
    try {
      const res = await simulate({
        data: {
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      const tags: string[] = [];
      if (res.orderConfirmed) tags.push("ORDER_CONFIRMED");
      if (res.orderCancelled) tags.push("ORDER_CANCELLED");
      setMessages([...nextHistory, { role: "assistant", content: res.reply, tags }]);
    } catch (e) {
      setMessages([...nextHistory, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Simulator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test the WhatsApp AI agent without needing a live WhatsApp number. Uses the same prompt, tools, and model.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMessages([])}>
          <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reset
        </Button>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4" /> Test conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 bg-muted/20 min-h-[400px] max-h-[60vh] overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-12">
              Type a message below as if you were a customer.
            </div>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${isUser ? "bg-primary text-primary-foreground" : "bg-white border"}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] opacity-70 mb-1">
                    {isUser ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    {isUser ? "You (customer)" : "AI"}
                  </div>
                  {m.content}
                  {m.tags && m.tags.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {m.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-2xl px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> AI is typing…
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Input
          placeholder="Salaam, price kya hai?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}