import { describe, expect, it } from "vitest";
import { duplicateIndexes, duplicateWordIds, isDuplicateGerman, parseImport } from "@/lib/import";

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

describe("duplicateWordIds", () => {
  it("marks every occurrence after the first as duplicate, ignoring case and spacing", () => {
    const words = [
      { id: "a", german: "der Hund" },
      { id: "b", german: "Die Katze" },
      { id: "c", german: "DER   hund" },
      { id: "d", german: "die Katze" },
      { id: "e", german: "das Haus" },
    ];
    expect([...duplicateWordIds(words)]).toEqual(["c", "d"]);
  });
  it("returns nothing when all words are unique", () => {
    expect(duplicateWordIds([{ id: "a", german: "der Hund" }, { id: "b", german: "die Katze" }]).size).toBe(0);
  });
});

describe("isDuplicateGerman", () => {
  it("detects the same German form under another id", () => {
    const words = [{ id: "a", german: "der Hund" }, { id: "b", german: "die Katze" }];
    expect(isDuplicateGerman("Der  hund", "b", words)).toBe(true);
    expect(isDuplicateGerman("das Haus", "b", words)).toBe(false);
    expect(isDuplicateGerman("die Katze", "b", words)).toBe(false);
  });
});
