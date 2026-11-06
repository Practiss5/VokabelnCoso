import { expect, it } from "vitest";
import { duelOutcome } from "@/components/Duels";
it("plus de bonnes réponses gagne", () => expect(duelOutcome({ score: 8, ms: 90000 }, { score: 7, ms: 10000 })).toBe("win"));
it("égalité de points: le plus rapide gagne", () => expect(duelOutcome({ score: 7, ms: 30000 }, { score: 7, ms: 20000 })).toBe("loss"));
it("même score et même temps: égalité", () => expect(duelOutcome({ score: 5, ms: 1 }, { score: 5, ms: 1 })).toBe("tie"));
