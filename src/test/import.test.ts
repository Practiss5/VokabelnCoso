import { describe, expect, it } from "vitest";
import { duplicateIndexes, parseImport } from "@/lib/import";

describe("duplicateIndexes", () => {
  it("flags words already in the list (case/space-insensitive) and repeats in the paste", () => {
    const rows = [{ german: "Der  Hund" }, { german: "die Katze" }, { german: "die Katze" }];
    expect([...duplicateIndexes(rows, ["der Hund"])]).toEqual([0, 2]);
  });
});

describe("parseImport", () => {
  it("reads Quizlet tab export", () => {
    expect(parseImport("der Hund\tle chien\ndie Katze\tle chat")).toEqual([
      { german: "der Hund", french: "le chien", ok: true },
      { german: "die Katze", french: "le chat", ok: true },
    ]);
  });
  it("keeps the plural comma with = separator", () => {
    expect(parseImport("das Haus, ¨-er = la maison")[0]).toMatchObject({ german: "das Haus, ¨-er", french: "la maison" });
  });
  it("swaps when French is on the left", () => {
    expect(parseImport("le chien ; der Hund\nla maison ; das Haus")[1]).toMatchObject({ german: "das Haus", french: "la maison" });
  });
  it("flags lines without separator", () => {
    expect(parseImport("Hund")[0]?.ok).toBe(false);
  });
});
