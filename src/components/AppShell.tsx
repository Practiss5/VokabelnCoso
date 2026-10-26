import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { DysToggle } from "@/components/DysToggle";
import { displayEmail } from "@/lib/student-code";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-3 pl-16 pr-4">
          <Link to="/espace" className="font-display text-lg font-bold">
            Vokabeln<span className="text-accent-foreground bg-accent ml-1 rounded px-1">.</span>
          </Link>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <DysToggle />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {me?.fullName || displayEmail(me?.email ?? "")} · {me?.isTeacher ? "Enseignant" : "Élève"}
            </span>
            <Button size="sm" variant="outline" onClick={signOut}>Déconnexion</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
