export type TaggableHomework = { id: string; word_ids: string[] | null; due_at: string; archived_at: string | null };

const hasWord = (h: TaggableHomework, wordId: string) => !h.word_ids?.length || h.word_ids.includes(wordId);

/**
 * The single homework an answer counts for: the clicked homework if it contains the word (even late),
 * otherwise the active homework containing the word that ends first. Archived homeworks never get answers.
 */
export function pickHomeworkForAnswer(hws: TaggableHomework[], wordId: string, explicit: string | undefined, now: Date): string | null {
  const open = hws.filter((h) => !h.archived_at && hasWord(h, wordId));
  if (explicit && open.some((h) => h.id === explicit)) return explicit;
  const active = open.filter((h) => new Date(h.due_at).getTime() > now.getTime())
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  return active[0]?.id ?? null;
}
