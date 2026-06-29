import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar userEmail={user?.email} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}