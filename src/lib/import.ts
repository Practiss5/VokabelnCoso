export type ImportRow = { german: string; french: string; ok: boolean };

const DE_HINT = /^(der|die|das|ein|eine|sich)\s|[äöüßÄÖÜ]|\b(en|ern|eln)\b$/i;
const FR_HINT = /^(le|la|les|l'|l’|un|une|des|du)\s?|[éèêàçùûôî]/i;

/** Split one line into [left, right] using the most likely separator (Quizlet tab first). */
export function splitLine(line: string): [string, string] | null {
  const seps = [/\t+/, /\s*=\s*/, /\s*;\s*/, /\s+[-–—:]\s+/];
  for (const s of seps) {
    const m = line.match(s);
    if (m && m.index !== undefined && m.index > 0) {
      return [line.slice(0, m.index), line.slice(m.index + m[0].length)];
    }
  }
  const i = line.lastIndexOf(",");
  if (i > 0) return [line.slice(0, i), line.slice(i + 1)];
  return null;
}

/** Parse pasted text (Quizlet, Excel, Word) into German/French rows; swaps columns if French is on the left. */
export function parseImport(text: string): ImportRow[] {
  const pairs = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => splitLine(l))
    .map((p) => (p ? [p[0].trim(), p[1].trim()] as [string, string] : null));
  // Decide orientation for the whole paste.
  let score = 0;
  for (const p of pairs) {
    if (!p) continue;
    if (DE_HINT.test(p[0])) score++;
    if (FR_HINT.test(p[0])) score--;
    if (DE_HINT.test(p[1])) score--;
    if (FR_HINT.test(p[1])) score++;
  }
  const swap = score < 0;
  return pairs.map((p) => {
    if (!p) return { german: "", french: "", ok: false };
    const [german, french] = swap ? [p[1], p[0]] : p;
    return { german, french, ok: !!german && !!french };
  });
}
