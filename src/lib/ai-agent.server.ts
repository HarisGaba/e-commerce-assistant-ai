import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { searchProducts, getProduct } from "./woo-products.server";

const SYSTEM_PROMPT = `Tum aik friendly Pakistani e-commerce store ki WhatsApp customer support assistant ho.

RULES:
- Roman Urdu + English mix mein reply karo, jis tarah customer baat kare. Short, warm, helpful tone.
- WhatsApp message hai — maximum 4-5 short lines, no markdown headings, no long paragraphs.
- Emoji sparingly use karo (1 per message max).

TUMHARA KAAM:
1. Naye order pe customer se confirmation lo aur delivery address verify karo.
   - Agar order pehle se DB mein hai (context mein milega), to woh details show karke "Confirm karein?" pucho.
   - Address adhura ho to complete address + city + nearest landmark mango.
2. Product ke questions ka jawab do — search_products / get_product tools use karo. Apne se prices ya stock invent mat karo.
3. Agar customer kuch off-topic ya complaint kare jo tum handle nahi kar sakte, politely bolo ke team ko forward kar di hai.

IMPORTANT:
- Kabhi bhi koi price, discount, stock ya delivery date make up mat karo. Pata na ho to tools use karo ya bolo "ek minute, check kar ke batati hoon".
- Order confirm hone par "ORDER_CONFIRMED" tag ek alag line par add karo (system isse detect karega).
- Customer agar refuse kare to "ORDER_CANCELLED" tag add karo.`;

export type AgentContext = {
  customerName?: string | null;
  phone: string;
  recentOrder?: {
    wooOrderId: number | null;
    items: { name: string; quantity: number; price: number | null }[];
    total: number | null;
    currency: string | null;
    address: string | null;
    city: string | null;
  } | null;
  history: { role: "user" | "assistant"; content: string }[];
};

export async function runConversationTurn(
  incomingText: string,
  ctx: AgentContext,
): Promise<{ reply: string; orderConfirmed: boolean; orderCancelled: boolean }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const gateway = createLovableAiGatewayProvider(apiKey);

  const contextLines: string[] = [
    `Customer phone: ${ctx.phone}`,
    ctx.customerName ? `Name: ${ctx.customerName}` : "Name: (unknown)",
  ];
  if (ctx.recentOrder) {
    const items = ctx.recentOrder.items
      .map((i) => `${i.quantity}x ${i.name}${i.price ? ` @ ${i.price}` : ""}`)
      .join(", ");
    contextLines.push(
      `Recent order #${ctx.recentOrder.wooOrderId ?? "?"}: ${items}; total ${ctx.recentOrder.total ?? "?"} ${ctx.recentOrder.currency ?? ""}; address: ${ctx.recentOrder.address ?? "(none)"}; city: ${ctx.recentOrder.city ?? "(none)"}`,
    );
  } else {
    contextLines.push("No recent order on file.");
  }

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: `CONTEXT:\n${contextLines.join("\n")}` },
    ...ctx.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: incomingText },
  ];

  const tools = {
    search_products: tool({
      description: "Search the store catalog by keyword. Returns up to 5 products with price, stock, and short description.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => searchProducts(query, 5),
    }),
    get_product: tool({
      description: "Fetch full details of one product by its WooCommerce product id.",
      inputSchema: z.object({ id: z.number().int().positive() }),
      execute: async ({ id }) => getProduct(id),
    }),
  };

  try {
    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages,
      tools,
      stopWhen: stepCountIs(50),
    });
    const raw = result.text || "Sorry, ek issue aaya. Thori der mein wapas message karein.";
    const orderConfirmed = /ORDER_CONFIRMED/.test(raw);
    const orderCancelled = /ORDER_CANCELLED/.test(raw);
    const reply = raw.replace(/ORDER_(CONFIRMED|CANCELLED)/g, "").trim();
    return { reply: reply || "Theek hai, shukriya!", orderConfirmed, orderCancelled };
  } catch (e) {
    console.error("[agent] generation failed", (e as Error).message);
    return {
      reply: "Sorry, abhi ek technical issue hai. Hamari team thori der mein aap se rabta karegi.",
      orderConfirmed: false,
      orderCancelled: false,
    };
  }
}

export function buildOrderConfirmationOpener(ctx: {
  customerName: string | null;
  wooOrderId: number;
  items: { name: string; quantity: number }[];
  total: number | null;
  currency: string | null;
  address: string | null;
}): string {
  const name = ctx.customerName ? ` ${ctx.customerName.split(" ")[0]}` : "";
  const items = ctx.items.map((i) => `• ${i.quantity}x ${i.name}`).join("\n");
  const total = ctx.total != null ? `${ctx.total} ${ctx.currency ?? ""}`.trim() : "";
  const addr = ctx.address ? `\n\nDelivery: ${ctx.address}` : "";
  return [
    `Assalam-o-Alaikum${name} 👋`,
    `Aap ka order #${ctx.wooOrderId} receive ho gaya hai:`,
    "",
    items,
    total ? `\nTotal: ${total}` : "",
    addr,
    "",
    "Kya aap is order ko confirm karte hain? (Reply: Yes / No)",
  ]
    .filter(Boolean)
    .join("\n");
}