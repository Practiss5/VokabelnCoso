import { expect, it } from "vitest";
import { duelOutcome } from "@/components/Duels";
import { pendingDuels } from "@/lib/duels";
it("plus de bonnes réponses gagne", () => expect(duelOutcome({ score: 8, ms: 90000 }, { score: 7, ms: 10000 })).toBe("win"));
it("égalité de points: le plus rapide gagne", () => expect(duelOutcome({ score: 7, ms: 30000 }, { score: 7, ms: 20000 })).toBe("loss"));
it("même score et même temps: égalité", () => expect(duelOutcome({ score: 5, ms: 1 }, { score: 5, ms: 1 })).toBe("tie"));
it("alerte uniquement pour les duels non terminés et non expirés, y compris en cours", () => {
  const now = Date.parse("2026-11-12T06:05:00Z");
  const duels = [
    { id: "waiting", my_finished: false, expires_at: "2026-11-13T06:05:00Z" },
    { id: "finished", my_finished: true, expires_at: "2026-11-13T06:05:00Z" },
    { id: "expired", my_finished: false, expires_at: "2026-11-12T06:05:00Z" },
  ];
  expect(pendingDuels(duels, now).map((d) => d.id)).toEqual(["waiting"]);
});
