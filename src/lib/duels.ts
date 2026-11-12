import { supabase } from "@/integrations/supabase/client";

export const myDuelsQuery = {
  queryKey: ["my-duels"],
  refetchInterval: 30000,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_duels");
    if (error) throw error;
    return data ?? [];
  },
};

export function pendingDuels<T extends { my_finished: boolean; expires_at: string }>(duels: T[], now = Date.now()): T[] {
  return duels.filter((d) => !d.my_finished && new Date(d.expires_at).getTime() > now);
}