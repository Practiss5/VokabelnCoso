import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { meQuery } from "@/lib/session";

/** UI convenience only — database rules (RLS) are what actually block students. */
export function TeacherOnly({ children }: { children: ReactNode }) {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me?.isTeacher)
    return <p className="rounded-lg bg-secondary p-4">Cet espace est réservé aux enseignants.</p>;
  return <>{children}</>;
}
