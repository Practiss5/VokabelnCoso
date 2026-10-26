import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Gestion des codes élèves d'une classe : génération, étiquettes,
 * révocation. Les codes sont créés côté base de données (RPC
 * generate_student_codes) et ne sont visibles que par l'enseignant
 * de la classe (RLS).
 */
export function StudentCodes({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [count, setCount] = useState(25);
  const [busy, setBusy] = useState(false);

  const { data: codes } = useQuery({
    queryKey: ["student-codes", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_codes")
        .select("id, code, label, student_id, revoked, created_at")
        .eq("class_id", classId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  async function generate() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("generate_student_codes", { _class: classId, _count: count });
      if (error) throw error;
      toast.success(`${count} codes générés.`);
      qc.invalidateQueries({ queryKey: ["student-codes", classId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function setLabel(id: string, label: string) {
    const { error } = await supabase.from("student_codes").update({ label: label.slice(0, 60) }).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function toggleRevoke(id: string, revoked: boolean) {
    const { error } = await supabase.from("student_codes").update({ revoked: !revoked }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["student-codes", classId] });
  }

  async function removeCode(id: string) {
    if (!confirm("Supprimer ce code définitivement ?")) return;
    const { error } = await supabase.from("student_codes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["student-codes", classId] });
  }

  function copyAll() {
    const text = (codes ?? [])
      .filter((c) => !c.revoked)
      .map((c) => `${c.code}${c.label ? ` — ${c.label}` : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Liste des codes copiée."),
      () => toast.error("Copie impossible."),
    );
  }

  const list = codes ?? [];
  const active = list.filter((c) => !c.revoked);

  return (
    <section className="word-card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">🔑 Codes élèves</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque élève se connecte avec son code de 8 caractères, puis choisit un code secret à 6 chiffres. Aucune adresse e-mail n'est demandée.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm">
            Nombre
            <Input
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className="mt-1 w-20"
            />
          </label>
          <Button onClick={generate} disabled={busy}>{busy ? "…" : "➕ Générer des codes"}</Button>
          {active.length > 0 && (
            <Button variant="outline" onClick={copyAll}>📋 Copier la liste</Button>
          )}
        </div>
      </div>

      {list.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Code</th>
                <th className="p-2">Étiquette (prénom ou n°)</th>
                <th className="p-2">Statut</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((c) => (
                <tr key={c.id} className={c.revoked ? "opacity-50" : ""}>
                  <td className="p-2 font-mono text-base font-bold tracking-widest">{c.code}</td>
                  <td className="p-2">
                    <Input
                      defaultValue={c.label}
                      placeholder="ex. Lucas"
                      onBlur={(e) => { if (e.target.value !== c.label) setLabel(c.id, e.target.value); }}
                      className="h-8 w-40"
                    />
                  </td>
                  <td className="p-2">
                    {c.revoked ? "🚫 Révoqué" : c.student_id ? "✅ Activé" : "⏳ En attente"}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleRevoke(c.id, c.revoked)}>
                        {c.revoked ? "Réactiver" : "Révoquer"}
                      </Button>
                      {!c.student_id && (
                        <Button size="sm" variant="destructive" onClick={() => removeCode(c.id)}>Supprimer</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-secondary p-3 text-sm">
          Aucun code pour l'instant. Génère un code par élève, imprime ou copie la liste, puis distribue un code à chacun.
        </p>
      )}
    </section>
  );
}
