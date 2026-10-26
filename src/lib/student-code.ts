/**
 * Connexion sans e-mail : les élèves utilisent un code de 8 caractères
 * (+ un code secret à 6 chiffres) et les enseignants un identifiant.
 * En coulisses, ces identifiants sont convertis en adresses e-mail
 * synthétiques (.local) pour le système d'authentification — aucune
 * vraie adresse e-mail n'est collectée.
 */

/** Majuscules, sans espaces ni tirets (l'élève peut taper "k7m9-p2x4"). */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(normalizeCode(code));
}

/** E-mail synthétique dérivé du code élève (jamais affiché, jamais utilisé pour envoyer du courrier). */
export function studentEmail(code: string): string {
  return `s-${normalizeCode(code).toLowerCase()}@eleve.vokabeln.local`;
}

/** Identifiant enseignant : minuscules, lettres/chiffres et . _ - */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function teacherEmail(username: string): string {
  return `t-${normalizeUsername(username)}@prof.vokabeln.local`;
}

/** Identifiant de connexion enseignant → e-mail réel ou synthétique. */
export function loginEmail(identifier: string): string {
  const id = identifier.trim();
  return id.includes("@") ? id : teacherEmail(id);
}

/** Code secret élève : exactement 6 chiffres. */
export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/** Nom lisible dans l'en-tête : masque les e-mails synthétiques. */
export function displayEmail(email: string): string {
  if (email.endsWith("@eleve.vokabeln.local")) return "Élève";
  if (email.endsWith("@prof.vokabeln.local")) return email.split("@")[0]?.replace(/^t-/, "") ?? email;
  return email;
}
