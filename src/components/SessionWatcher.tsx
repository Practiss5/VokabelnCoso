import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const LAST_CODE_KEY = "vokabeln:last-student-code";

/** Detects an expired session when the student comes back to the tab and offers a direct reconnect. */
export function SessionWatcher({ email }: { email: string }) {
  const [expired, setExpired] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const m = email.match(/^s-([a-z0-9]{8})@eleve\.vokabeln\.local$/);
    if (m) localStorage.setItem(LAST_CODE_KEY, m[1]!.toUpperCase());
  }, [email]);

  useEffect(() => {
    let busy = false;
    async function check() {
      if (busy || document.visibilityState !== "visible" || navigator.onLine === false) return;
      busy = true;
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) { setExpired(true); return; }
        const { data, error } = await supabase.auth.getUser();
        if (!data.user && error && !/fetch|network/i.test(error.message)) setExpired(true);
      } finally { busy = false; }
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) setExpired(true);
      if (event === "SIGNED_IN") setExpired(false);
    });
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!expired) return null;
  return (
    <div role="alertdialog" aria-labelledby="pause-title" className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-lg">
        <h2 id="pause-title" className="font-display text-xl font-bold">Pause terminée !</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ta session a expiré pendant ta pause. Reconnecte-toi pour continuer : tes réponses déjà données sont gardées.
        </p>
        <Button className="mt-4 w-full" onClick={async () => {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          navigate({ to: "/auth", replace: true });
        }}>Se reconnecter</Button>
      </div>
    </div>
  );
}
