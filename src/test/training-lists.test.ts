import { describe, expect, it } from "vitest";
import { selectTrainingList } from "@/lib/training-lists";

const lists = [
  { id: "old", title: "Ancienne liste", assignedAt: "2026-11-01T10:00:00Z" },
  { id: "latest", title: "Nouvelle liste", assignedAt: "2026-11-06T06:00:00Z" },
];

describe("student training list", () => {
  it("defaults to the most recently assigned list", () => {
    expect(selectTrainingList(lists)).toBe("latest");
  });
  it("allows the student to choose an older assigned list", () => {
    expect(selectTrainingList(lists, "old")).toBe("old");
  });
  it("falls back to latest when a requested list is not assigned", () => {
    expect(selectTrainingList(lists, "other-class")).toBe("latest");
  });
  it("does not choose a list when none is assigned", () => {
    expect(selectTrainingList([])).toBeUndefined();
  });
});