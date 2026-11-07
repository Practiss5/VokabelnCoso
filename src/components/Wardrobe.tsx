import { useEffect, useState } from "react";
import { ITEMS, MASCOTS, SLOT_LABELS, type Slot, type WardrobeStats } from "@/lib/wardrobe";
import { Button } from "@/components/ui/button";

type Outfit = { mascot: string } & Partial<Record<Slot, string>>;
const SLOTS: Slot[] = ["hat", "eyes", "neck", "hand", "bg"];

export function Avatar({ outfit, size = 96 }: { outfit: Outfit; size?: number }) {
  const m = MASCOTS.find((x) => x.id === outfit.mascot) ?? MASCOTS[0];
  const icon = (slot: Slot) => ITEMS.find((i) => i.id === outfit[slot])?.icon;
  const f = size / 96;
  return (
    <div aria-label={`Ma mascotte : ${m.name}`} className="relative shrink-0 overflow-hidden rounded-2xl border-2 border-accent bg-muted" style={{ width: size * 1.4, height: size * 1.4 }}>
      {icon("bg") && <span aria-hidden className="absolute inset-0 flex items-end justify-center opacity-40" style={{ fontSize: 110 * f }}>{icon("bg")}</span>}
      <span aria-hidden className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 70 * f }}>{m.icon}</span>
      {icon("hat") && <span aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ top: 2 * f, fontSize: 34 * f }}>{icon("hat")}</span>}
      {icon("eyes") && <span aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ top: 44 * f, fontSize: 26 * f }}>{icon("eyes")}</span>}
      {icon("neck") && <span aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 4 * f, fontSize: 28 * f }}>{icon("neck")}</span>}
      {icon("hand") && <span aria-hidden className="absolute" style={{ right: 4 * f, bottom: 18 * f, fontSize: 28 * f }}>{icon("hand")}</span>}
    </div>
  );
}

/** Student: pick a mascot and equip unlocked accessories. Choice is kept on this device. */
export function Wardrobe({ studentId, stats }: { studentId: string; stats: WardrobeStats }) {
  const key = `vokabeln:outfit:${studentId}`;
  const [outfit, setOutfit] = useState<Outfit>({ mascot: "dackel" });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { const v = localStorage.getItem(key); if (v) setOutfit(JSON.parse(v)); } catch { /* ignore */ }
  }, [key]);
  const save = (o: Outfit) => { setOutfit(o); localStorage.setItem(key, JSON.stringify(o)); };
  const unlocked = ITEMS.filter((i) => i.unlocked(stats)).length;
  const mascot = MASCOTS.find((m) => m.id === outfit.mascot) ?? MASCOTS[0];

  return (
    <section className="space-y-3">
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
                <button key={m.id} type="button" title={m.name} aria-pressed={outfit.mascot === m.id} onClick={() => save({ ...outfit, mascot: m.id })}
                  className={`rounded-xl border-2 p-2 text-3xl ${outfit.mascot === m.id ? "border-accent bg-accent/20" : "border-border"}`}>
                  <span aria-hidden>{m.icon}</span><span className="sr-only">{m.name}</span>
                </button>
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
                    <button key={i.id} type="button" disabled={!ok} aria-pressed={on}
                      onClick={() => save({ ...outfit, [slot]: on ? undefined : i.id })}
                      className={`rounded-xl border-2 p-2 text-center ${on ? "border-accent bg-accent/20" : "border-border"} ${ok ? "" : "cursor-not-allowed opacity-60"}`}>
                      <div aria-hidden className={`text-3xl ${ok ? "" : "grayscale"}`}>{i.icon}</div>
                      <p className="text-sm font-semibold">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{ok ? (on ? "Porté ✓" : "Débloqué") : `🔒 ${i.rule}`}</p>
                    </button>
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
