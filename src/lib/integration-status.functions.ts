import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntegrationStatus = {
  woocommerce: boolean;
  googleSheets: boolean;
  whatsapp: boolean;
  postex: boolean;
  lovableAi: boolean;
};

export const getIntegrationStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<IntegrationStatus> => {
    return {
      woocommerce: !!process.env.WOOCOMMERCE_API_KEY,
      googleSheets: !!(process.env.GOOGLE_SHEETS_API_KEY && process.env.GOOGLE_SHEET_ID),
      whatsapp: !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_APP_SECRET),
      postex: !!process.env.POSTEX_WEBHOOK_SECRET,
      lovableAi: !!process.env.LOVABLE_API_KEY,
    };
  });