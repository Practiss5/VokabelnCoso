import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TrainingList = { id: string; title: string; assignedAt: string };

export function selectTrainingList(lists: TrainingList[], requested?: string): string | undefined {
  if (requested && lists.some((list) => list.id === requested)) return requested;
  return [...lists].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt) || a.id.localeCompare(b.id))[0]?.id;
}

export const trainingListsQuery = (classId: string) => queryOptions({
  queryKey: ["training-lists", classId],
  enabled: Boolean(classId),
  queryFn: async (): Promise<TrainingList[]> => {
    const { data, error } = await supabase.from("list_assignments")
      .select("created_at, vocab_lists(id, title)").eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).flatMap((assignment) => assignment.vocab_lists
      ? [{ ...assignment.vocab_lists, assignedAt: assignment.created_at }] : []);
  },
});