// The pathless _authenticated layout gates every child route on client-side.
// SSR is off because Supabase stores the session in localStorage.
import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Briefcase, Settings2, Plug, LayoutDashboard, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <Briefcase className="h-5 w-5 text-primary" /> Job Agent
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</NavLink>
            <NavLink to="/jobs" icon={<Briefcase className="h-4 w-4" />}>Jobs</NavLink>
            <NavLink to="/settings" icon={<Settings2 className="h-4 w-4" />}>Settings</NavLink>
            <NavLink to="/integrations" icon={<Plug className="h-4 w-4" />}>Integrations</NavLink>
            <Button variant="ghost" size="sm" onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/auth" });
            }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
      activeProps={{ className: "active" }}
    >
      {icon} {children}
    </Link>
  );
}
