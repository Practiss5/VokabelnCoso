import { describe, it, expect } from "vitest";
import { verbForms, checkVerbForms } from "@/lib/vocab";

const f = verbForms("fahren, er fährt, ist gefahren")!;
describe("saisie guidée des verbes", () => {
  it("découpe les 3 formes", () => expect(f).toEqual(["fahren", "er fährt", "ist gefahren"]));
  it("nom ou 2 formes: pas de cases", () => { expect(verbForms("die Stadt, ”-e")).toBeNull(); expect(verbForms("fahren, er fährt")).toBeNull(); });
  it("3 cases justes", () => expect(checkVerbForms(["fahren", "er fährt", "ist gefahren"], f).verdict).toBe("correct"));
  it("pronom facultatif", () => expect(checkVerbForms(["fahren", "fährt", "ist gefahren"], f).verdict).toBe("correct"));
  it("auxiliaire requis", () => expect(checkVerbForms(["fahren", "er fährt", "gefahren"], f).verdict).not.toBe("correct"));
  it("coquille = presque", () => expect(checkVerbForms(["fahren", "er fährt", "ist gefahen"], f).verdict).toBe("near"));
  it("case vide = faux", () => expect(checkVerbForms(["fahren", "", "ist gefahren"], f).verdict).toBe("wrong"));
});
