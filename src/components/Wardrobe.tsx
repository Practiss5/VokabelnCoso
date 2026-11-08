import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ITEMS, MASCOTS, SLOT_LABELS, type Slot, type WardrobeStats } from "@/lib/wardrobe";
import { Button } from "@/components/ui/button";
import { MascotArt } from "@/components/MascotArt";

export type Outfit = { mascot: string } & Partial<Record<Slot, string>>;
const SLOTS: Slot[] = ["hat", "eyes", "neck", "hand", "bg"];

/** Coerce stored jsonb into a safe outfit. */
export function asOutfit(raw: unknown): Outfit {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<Outfit>;
  return { ...o, mascot: typeof o.mascot === "string" ? o.mascot : "dackel" };
}

/** Avatar from a stored outfit (jsonb from profiles / RPCs). */
export function Avatar({ outfit: raw, size = 96 }: { outfit: unknown; size?: number }) {
  const outfit = asOutfit(raw);
  const m = MASCOTS.find((x) => x.id === outfit.mascot) ?? MASCOTS[0];
  return (
    <div role="img" aria-label={`Ma mascotte : ${m.name}`} className="shrink-0 overflow-hidden rounded-lg bg-muted" style={{ width: size * 1.4, height: size * 1.4 }}>
      <MascotArt mascot={m.id} outfit={outfit} />
    </div>
  );
}

/** Student: pick a mascot and equip unlocked accessories. The outfit is saved on the account and shown in duels and class quizzes. */
export function Wardrobe({ studentId, stats }: { studentId: string; stats: WardrobeStats }) {
  const key = `vokabeln:outfit:${studentId}`;
  const [outfit, setOutfit] = useState<Outfit>({ mascot: "dackel" });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    try { const v = localStorage.getItem(key); if (v) setOutfit(JSON.parse(v)); } catch { /* ignore */ }
    // The account copy wins over the device cache.
    void supabase.from("profiles").select("outfit").eq("id", studentId).single().then(({ data }) => {
      const o = data?.outfit as Outfit | null;
      if (o?.mascot) { setOutfit(o); localStorage.setItem(key, JSON.stringify(o)); }
    });
  }, [key, studentId]);
  const save = (o: Outfit) => {
    setOutfit(o);
    localStorage.setItem(key, JSON.stringify(o));
    void supabase.rpc("save_my_outfit", { _outfit: o }).then(() => qc.invalidateQueries({ queryKey: ["outfit", studentId] }));
  };
  const unlocked = ITEMS.filter((i) => i.unlocked(stats)).length;
  const mascot = MASCOTS.find((m) => m.id === outfit.mascot) ?? MASCOTS[0];

  return (
    <section id="vestiaire" className="scroll-mt-24 space-y-3">
      <div className="word-card flex flex-wrap items-center gap-4 p-4">
        <Avatar outfit={outfit} />
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Mon vestiaire</h2>
          <p className="text-muted-foreground">{mascot.name} · {unlocked}/{ITEMS.length} accessoires débloqués</p>
        </div>
        <Button variant={open ? "secondary" : "default"} onClick={() => setOpen(!open)}>{open ? "Fermer" : "Habiller ma mascotte"}</Button>
      </div>
      {open && (
        <div className="word-card space-y-5 p-4">
          <div>
            <h3 className="mb-2 font-bold">Mascotte</h3>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {MASCOTS.map((m) => (
                <Button key={m.id} variant="outline" type="button" title={m.name} aria-pressed={outfit.mascot === m.id} onClick={() => save({ ...outfit, mascot: m.id })}
                  className={`h-auto min-w-0 aspect-square p-0 [&_svg.mascot-art]:size-full ${outfit.mascot === m.id ? "border-2 border-accent bg-accent/20" : "border-border"}`}>
                  <MascotArt mascot={m.id} /><span className="sr-only">{m.name}</span>
                </Button>
              ))}
            </div>
          </div>
          {SLOTS.map((slot) => (
            <div key={slot}>
              <h3 className="mb-2 font-bold">{SLOT_LABELS[slot]}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {ITEMS.filter((i) => i.slot === slot).map((i) => {
                  const ok = i.unlocked(stats);
                  const on = outfit[slot] === i.id;
                  return (
                    <Button key={i.id} variant="outline" type="button" disabled={!ok} aria-pressed={on}
                      onClick={() => save({ ...outfit, [slot]: on ? undefined : i.id })}
                      className={`h-auto min-w-0 flex-col whitespace-normal border-2 p-2 text-center [&_svg.mascot-art]:size-full ${on ? "border-accent bg-accent/20" : "border-border"} ${ok ? "" : "cursor-not-allowed opacity-60"}`}>
                      <div aria-hidden className={`w-20 max-w-full aspect-square ${ok ? "" : "grayscale"}`}><MascotArt mascot={mascot.id} outfit={{ [slot]: i.id }} /></div>
                      <span className="text-sm font-semibold">{i.name}</span>
                      <span className="text-xs text-muted-foreground">{ok ? (on ? "Porté ✓" : "Débloqué") : `🔒 ${i.rule}`}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
