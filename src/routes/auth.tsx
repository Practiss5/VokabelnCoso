import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DysToggle } from "@/components/DysToggle";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode | undefined } => ({
    mode: s["mode"] === "signup" || s["mode"] === "forgot" ? s["mode"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion — Vocabulaire Allemand" },
      { name: "description", content: "Connectez-vous ou créez votre compte élève." },
      { property: "og:title", content: "Connexion — Vocabulaire Allemand" },
      { property: "og:description", content: "Accès enseignant et élève." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/espace" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/espace",
            data: { full_name: fullName.trim(), class_code: classCode.trim() },
          },
        });
        if (error) throw error;
        setSent("Compte créé ! Ouvrez l'e-mail de confirmation pour activer votre compte.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setSent("Si ce compte existe, un e-mail de réinitialisation a été envoyé.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg === "Invalid login credentials" ? "E-mail ou mot de passe incorrect" : msg);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Connexion" : mode === "signup" ? "Créer un compte élève" : "Mot de passe oublié";

  return (
    <main className="paper-lines relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4"><DysToggle /></div>
      <div className="word-card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        {sent ? (
          <p className="mt-6 rounded-lg bg-secondary p-4">{sent}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Prénom et nom</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code de classe (donné par l'enseignant)</Label>
                  <Input id="code" value={classCode} onChange={(e) => setClassCode(e.target.value.toUpperCase())} placeholder="ex. A1B2C3" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}
            </Button>
          </form>
        )}
        <div className="mt-6 flex flex-col gap-2 text-sm">
          {mode !== "login" && <button className="text-left underline" onClick={() => { setMode("login"); setSent(null); }}>J'ai déjà un compte</button>}
          {mode !== "signup" && <button className="text-left underline" onClick={() => { setMode("signup"); setSent(null); }}>Créer un compte élève</button>}
          {mode === "login" && <button className="text-left underline" onClick={() => setMode("forgot")}>Mot de passe oublié ?</button>}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Les comptes enseignants sont activés par l'administrateur de l'application.
        </p>
      </div>
    </main>
  );
}
