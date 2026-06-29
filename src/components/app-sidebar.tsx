import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  Package,
  Settings,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/orders", label: "Orders", icon: ShoppingBag },
  { to: "/app/conversations", label: "Conversations", icon: MessageSquare },
  { to: "/app/products", label: "Products", icon: Package },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ userEmail }: { userEmail?: string | null }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/app" className="flex items-center gap-2 font-semibold">
          <Bot className="w-5 h-5 text-primary" />
          Order Concierge
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as never}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors " +
                (active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {userEmail && (
          <div className="px-3 py-1.5 text-xs text-sidebar-foreground/60 truncate">{userEmail}</div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}