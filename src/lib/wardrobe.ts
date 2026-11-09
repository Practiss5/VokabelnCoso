/** Mascots and unlockable accessories ("Mon vestiaire"), derived from the student's real effort. */
import type { Badge } from "@/lib/badges";

export type WardrobeStats = {
  badges: Badge[];
  reviews: number;
  homeworksDone: number;
  onTimeRun: number;
  duelWins: number;
  masteredLists: number;
  distinctLists: number;
};
export type Slot = "hat" | "eyes" | "neck" | "hand" | "bg";
export type Item = { id: string; slot: Slot; icon: string; name: string; rule: string; unlocked: (s: WardrobeStats) => boolean };

export const MASCOTS = [
  { id: "dackel", icon: "🐕", name: "Der Dackel" },
  { id: "baer", icon: "🐻", name: "Der Berliner Bär" },
  { id: "fuchs", icon: "🦊", name: "Der Fuchs" },
  { id: "murmeltier", icon: "🦫", name: "Das Murmeltier" },
  { id: "eule", icon: "🦉", name: "Die Eule" },
  { id: "wolf", icon: "🐺", name: "Der Wolf" },
  { id: "eichhoernchen", icon: "🐿️", name: "Das Eichhörnchen" },
  { id: "bernhardiner", icon: "🐶", name: "Der Bernhardiner" },
  { id: "steinbock", icon: "🐐", name: "Der Steinbock" },
  { id: "igel", icon: "🦔", name: "Der Igel" },
] as const;

const lvl = (s: WardrobeStats, id: string) => s.badges.find((b) => b.id === id)?.level ?? 0;

export const ITEMS: Item[] = [
  { id: "cap", slot: "hat", icon: "🧢", name: "Casquette urbaine", rule: "Terminer un premier devoir", unlocked: (s) => s.homeworksDone >= 1 },
  { id: "tyrol", slot: "hat", icon: "👒", name: "Chapeau tyrolien", rule: "Réviser 100 mots", unlocked: (s) => s.reviews >= 100 },
  { id: "bonnet", slot: "hat", icon: "🎅", name: "Bonnet à pompon", rule: "Série de 5 jours (Flamme du jour)", unlocked: (s) => lvl(s, "streak") >= 2 },
  { id: "dj", slot: "hat", icon: "🎧", name: "Casque audio DJ", rule: "Badge Oreille d'or", unlocked: (s) => lvl(s, "ear") >= 1 },
  { id: "crown", slot: "hat", icon: "👑", name: "Couronne dorée", rule: "Badge Maître des genres", unlocked: (s) => lvl(s, "gender") >= 1 },
  { id: "aviator", slot: "eyes", icon: "🕶️", name: "Lunettes d'aviateur", rule: "Gagner un duel ou badge Sprint éclair", unlocked: (s) => s.duelWins >= 1 || lvl(s, "sprint") >= 1 },
  { id: "sport", slot: "eyes", icon: "🥽", name: "Lunettes de sport", rule: "Réviser 500 mots", unlocked: (s) => s.reviews >= 500 },
  { id: "monocle", slot: "eyes", icon: "🧐", name: "Monocle de détective", rule: "Badge Chasseur d'Umlaut", unlocked: (s) => lvl(s, "umlaut") >= 1 },
  { id: "scarf", slot: "neck", icon: "🧣", name: "Écharpe suisse / allemande", rule: "Badge Ponctuel", unlocked: (s) => lvl(s, "early") >= 1 },
  { id: "bow", slot: "neck", icon: "🎀", name: "Nœud papillon", rule: "Badge Zéro faute", unlocked: (s) => lvl(s, "perfect") >= 1 },
  { id: "vest", slot: "neck", icon: "🦺", name: "Gilet fluo", rule: "3 devoirs faits à l'heure d'affilée", unlocked: (s) => s.onTimeRun >= 3 },
  { id: "tshirt", slot: "neck", icon: "👕", name: "T-shirt « Deutsch-Meister »", rule: "Maîtriser une liste complète (écrit, QCM et audio)", unlocked: (s) => s.masteredLists >= 1 },
  { id: "apron", slot: "neck", icon: "🥼", name: "Tablier de boulanger", rule: "Badge Bâtisseur de mots", unlocked: (s) => lvl(s, "compound") >= 1 },
  { id: "medal", slot: "neck", icon: "🥇", name: "Médaille d'or", rule: "Réviser 1000 mots", unlocked: (s) => s.reviews >= 1000 },
  { id: "pretzel", slot: "hand", icon: "🥨", name: "Bretzel géant", rule: "Réviser 200 mots", unlocked: (s) => s.reviews >= 200 },
  { id: "flag", slot: "hand", icon: "🏁", name: "Drapeau à damier", rule: "Badge Sprint éclair", unlocked: (s) => lvl(s, "sprint") >= 1 },
  { id: "quill", slot: "hand", icon: "🪶", name: "Plume d'oie", rule: "Badge Plume d'or", unlocked: (s) => lvl(s, "pen") >= 1 },
  { id: "mic", slot: "hand", icon: "🎤", name: "Micro de scène", rule: "Badge Polyglotte en herbe", unlocked: (s) => lvl(s, "polyglot") >= 1 },
  { id: "mug", slot: "hand", icon: "☕", name: "Tasse fumante", rule: "Série de 3 jours", unlocked: (s) => lvl(s, "streak") >= 1 },
  { id: "forest", slot: "bg", icon: "🌲", name: "Forêt Noire", rule: "Maîtriser une liste complète (écrit, QCM et audio)", unlocked: (s) => s.masteredLists >= 1 },
  { id: "matterhorn", slot: "bg", icon: "🏔️", name: "Cervin enneigé", rule: "Réviser 1500 mots", unlocked: (s) => s.reviews >= 1500 },
  { id: "board", slot: "bg", icon: "📝", name: "Tableau noir", rule: "Réviser 5 listes différentes", unlocked: (s) => s.distinctLists >= 5 },
  { id: "castle", slot: "bg", icon: "🏰", name: "Neuschwanstein", rule: "Obtenir 8 badges différents", unlocked: (s) => s.badges.filter((b) => b.level > 0).length >= 8 },
  { id: "aurora", slot: "bg", icon: "🌌", name: "Aurore boréale", rule: "Série de 15 jours", unlocked: (s) => (s.badges.find((b) => b.id === "streak")?.value ?? 0) >= 15 },
];

export const SLOT_LABELS: Record<Slot, string> = { hat: "Chapeaux", eyes: "Lunettes", neck: "Tenues & cou", hand: "En patte", bg: "Décors" };

const WRITING = new Set(["typing", "context"]);
const QCM = new Set(["choice", "choice_de_fr", "choice_fr_de"]);
const LISTEN = new Set(["listen_de_fr", "listen_fr_de"]);

/** A list is mastered when every word was answered correctly at least once in writing, in QCM and in audio QCM. */
export function isMasteredList(wordIds: string[], reviews: { word_id: string; mode: string; correct: boolean }[]): boolean {
  if (wordIds.length === 0) return false;
  const ok = (modes: Set<string>) => new Set(reviews.filter((r) => r.correct && modes.has(r.mode)).map((r) => r.word_id));
  const written = ok(WRITING), qcm = ok(QCM), listen = ok(LISTEN);
  return wordIds.every((id) => written.has(id) && qcm.has(id) && listen.has(id));
}

/** Longest run of consecutive true values. */
export function longestRun(values: boolean[]): number {
  let best = 0, cur = 0;
  for (const v of values) { cur = v ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}
