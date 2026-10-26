import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DysToggle } from "@/components/DysToggle";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCode, isValidPin, loginEmail, normalizeCode, studentEmail } from "@/lib/student-code";
import { studentLogin } from "@/lib/student-login.functions";

type Tab = "eleve" | "prof";
type ProfMode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({
    tab: s["tab"] === "prof" ? "prof" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion — Vocabulaire Allemand" },
      { name: "description", content: "Connectez-vous avec votre code élève ou votre identifiant enseignant." },
      { property: "og:title", content: "Connexion — Vocabulaire Allemand" },
      { property: "og:description", content: "Accès enseignant et élève, sans adresse e-mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(search.tab ?? "eleve");

  return (
    <main className="paper-lines relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-4">
        <DysToggle prominent />
        <div className="word-card w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
            <button
              type="button"
              onClick={() => setTab("eleve")}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${tab === "eleve" ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              🎒 Élève
            </button>
            <button
              type="button"
              onClick={() => setTab("prof")}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${tab === "prof" ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              🧑‍🏫 Enseignant
            </button>
          </div>
          {tab === "eleve" ? <StudentLogin /> : <TeacherLogin />}
        </div>
      </div>
    </main>
  );
}

/* ---------------- Élève : code de 8 caractères + code secret ---------------- */

function StudentLogin() {
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<{ className: string; activated: boolean } | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeCode(code);
    if (!isValidCode(normalized)) {
      toast.error("Le code doit contenir 8 lettres ou chiffres.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("check_student_code", { _code: normalized });
      if (error) throw error;
      const row = data?.[0];
      if (!row) {
        toast.error("Code inconnu ou désactivé. Demande à ton enseignant.");
        return;
      }
      setCode(normalized);
      setInfo({ className: row.class_name, activated: row.activated });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    if (!isValidPin(pin)) {
      toast.error("Le code secret doit contenir exactement 6 chiffres.");
      return;
    }
    setBusy(true);
    try {
      if (info.activated) {
        const res = await studentLogin({ data: { code, pin } });
        if (!res.ok) {
          if (res.reason === "locked") toast.error(`Trop d'essais. Réessaie dans ${res.minutes} min.`);
          else if (res.locked_minutes) toast.error(`Code secret incorrect. Accès bloqué ${res.locked_minutes} min.`);
          else toast.error("Code secret incorrect.");
          return;
        }
        const { error } = await supabase.auth.setSession({ access_token: res.access_token, refresh_token: res.refresh_token });
        if (error) throw error;
        navigate({ to: "/espace" });
      } else {
        if (pin !== pin2) {
          toast.error("Les deux codes secrets ne sont pas identiques.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: studentEmail(code),
          password: pin,
          options: { data: { student_code: code } },
        });
        if (error) throw error;
        if (!data.session) {
          const signIn = await supabase.auth.signInWithPassword({ email: studentEmail(code), password: pin });
          if (signIn.error) throw signIn.error;
        }
        toast.success("Compte activé ! Bienvenue 🎉");
        navigate({ to: "/espace" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Connexion élève</h1>
      {!info ? (
        <form onSubmit={checkCode} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Ton code personnel (donné par l'enseignant)</Label>
            <Input
              id="code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ex. K7M9P2X4"
              maxLength={10}
              className="font-mono text-lg tracking-widest"
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "…" : "Continuer"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Aucune adresse e-mail n'est nécessaire. Si tu as perdu ton code, demande-le à ton enseignant.
          </p>
          <p className="text-xs text-muted-foreground">
            Ancien compte créé avec une adresse e-mail ? Connecte-toi dans l'onglet « Enseignant » avec ton e-mail : ton espace élève s'ouvrira normalement.
          </p>
        </form>
      ) : (
        <form onSubmit={submitPin} className="mt-6 space-y-4">
          <p className="rounded-lg bg-secondary p-3 text-sm">
            Classe : <b>{info.className}</b> · Code <span className="font-mono font-bold">{code}</span>
          </p>
          {info.activated ? (
            <div className="space-y-1.5">
              <Label htmlFor="pin">Ton code secret (6 chiffres)</Label>
              <Input
                id="pin"
                required
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="font-mono text-lg tracking-widest"
              />
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">Première connexion : choisis ton code secret.</p>
              <div className="space-y-1.5">
                <Label htmlFor="pin">Code secret (6 chiffres)</Label>
                <Input
                  id="pin"
                  required
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="font-mono text-lg tracking-widest"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pin2">Répète ton code secret</Label>
                <Input
                  id="pin2"
                  required
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
                  className="font-mono text-lg tracking-widest"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Retiens-le bien : il te sera demandé à chaque connexion. Si tu l'oublies, ton enseignant peut te donner un nouveau code.
              </p>
            </>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "…" : info.activated ? "Se connecter" : "Activer mon compte"}
          </Button>
          <button type="button" className="text-sm underline" onClick={() => { setInfo(null); setPin(""); setPin2(""); }}>
            ← Utiliser un autre code
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------------- Enseignant : identifiant (ou e-mail) + mot de passe ---------------- */

function TeacherLogin() {
  const [mode, setMode] = useState<ProfMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(identifier), password });
        if (error) {
          toast.error("Identifiant ou mot de passe incorrect.");
          return;
        }
        navigate({ to: "/espace" });
      } else if (mode === "signup") {
        if (password.length < 6) {
          toast.error("Le mot de passe doit contenir au moins 6 caractères.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: loginEmail(identifier),
          password,
          options: { data: { full_name: displayName.trim() } },
        });
        if (error) throw error;
        setSent("Compte créé ! Demande à l'administrateur de l'application d'activer ton accès enseignant, puis connecte-toi.");
      } else {
        if (!identifier.includes("@")) {
          toast.error("La réinitialisation n'est possible qu'avec une adresse e-mail. Sinon, contacte l'administrateur.");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setSent("Si ce compte existe, un e-mail de réinitialisation a été envoyé.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Connexion enseignant" : mode === "signup" ? "Créer un compte enseignant" : "Mot de passe oublié";

  return (
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>
      {sent ? (
        <p className="mt-6 rounded-lg bg-secondary p-4">{sent}</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Identifiant (ou e-mail)</Label>
            <Input
              id="identifier"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ex. m.dupont"
              autoComplete="username"
            />
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Prénom et nom (affiché dans l'application)</Label>
              <Input id="displayName" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          )}
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}
          </Button>
        </form>
      )}
      <div className="mt-6 flex flex-col gap-2 text-sm">
        {mode !== "login" && <button className="text-left underline" onClick={() => { setMode("login"); setSent(null); }}>J'ai déjà un compte</button>}
        {mode !== "signup" && <button className="text-left underline" onClick={() => { setMode("signup"); setSent(null); }}>Créer un compte enseignant</button>}
        {mode === "login" && <button className="text-left underline" onClick={() => setMode("forgot")}>Mot de passe oublié ?</button>}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Aucune adresse e-mail n'est obligatoire : un simple identifiant suffit. L'accès enseignant est validé par l'administrateur.
      </p>
    </div>
  );
}
