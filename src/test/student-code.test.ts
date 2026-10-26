import { describe, expect, it } from "vitest";
import {
  displayEmail,
  isValidCode,
  isValidPin,
  loginEmail,
  normalizeCode,
  normalizeUsername,
  studentEmail,
  teacherEmail,
} from "@/lib/student-code";

describe("normalizeCode", () => {
  it("met en majuscules et retire espaces et tirets", () => {
    expect(normalizeCode("k7m9-p2x4")).toBe("K7M9P2X4");
    expect(normalizeCode("  ab cd 1234 ")).toBe("ABCD1234");
  });
});

describe("isValidCode", () => {
  it("accepte exactement 8 caractères alphanumériques", () => {
    expect(isValidCode("K7M9P2X4")).toBe(true);
    expect(isValidCode("k7m9p2x4")).toBe(true);
  });
  it("refuse les longueurs incorrectes et caractères spéciaux", () => {
    expect(isValidCode("K7M9P2X")).toBe(false);
    expect(isValidCode("K7M9P2X45")).toBe(false);
    expect(isValidCode("K7M9P2X!")).toBe(false);
    expect(isValidCode("")).toBe(false);
  });
});

describe("studentEmail", () => {
  it("dérive un e-mail synthétique stable du code", () => {
    expect(studentEmail("K7M9P2X4")).toBe("s-k7m9p2x4@eleve.vokabeln.local");
    expect(studentEmail("k7m9-p2x4")).toBe("s-k7m9p2x4@eleve.vokabeln.local");
  });
});

describe("normalizeUsername / teacherEmail", () => {
  it("normalise l'identifiant enseignant", () => {
    expect(normalizeUsername("  M.Dupont ")).toBe("m.dupont");
    expect(normalizeUsername("Prof Martin!")).toBe("profmartin");
  });
  it("dérive un e-mail synthétique enseignant", () => {
    expect(teacherEmail("M.Dupont")).toBe("t-m.dupont@prof.vokabeln.local");
  });
});

describe("loginEmail", () => {
  it("conserve une vraie adresse e-mail", () => {
    expect(loginEmail("maxime@ecole.ch")).toBe("maxime@ecole.ch");
  });
  it("convertit un identifiant simple", () => {
    expect(loginEmail("weber")).toBe("t-weber@prof.vokabeln.local");
  });
});

describe("isValidPin", () => {
  it("exige exactement 6 chiffres", () => {
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12345a")).toBe(false);
  });
});

describe("displayEmail", () => {
  it("masque les e-mails synthétiques", () => {
    expect(displayEmail("s-k7m9p2x4@eleve.vokabeln.local")).toBe("Élève");
    expect(displayEmail("t-weber@prof.vokabeln.local")).toBe("weber");
    expect(displayEmail("maxime@ecole.ch")).toBe("maxime@ecole.ch");
  });
});
