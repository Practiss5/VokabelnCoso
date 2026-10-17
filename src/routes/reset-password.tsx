import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Vocabulaire Allemand" },
      { name: "description", content: "Choisir un nouveau mot de passe." },
      { property: "og:title", content: "Nouveau mot de passe" },
      { property: "og:description", content: "Réinitialisation du mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(error.message); return; }
    toast.success("Mot de passe modifié");
    navigate({ to: "/espace" });
  }
  return (
    <main className="paper-lines flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="word-card w-full max-w-md space-y-4 p-6">
        <h1 className="text-3xl font-bold">Nouveau mot de passe</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Mot de passe (8 caractères minimum)</Label>
          <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full">Enregistrer</Button>
      </form>
    </main>
  );
}
