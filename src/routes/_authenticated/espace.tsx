import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/espace")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me) throw redirect({ to: "/auth" });
    throw redirect({ to: me.isTeacher ? "/enseignant" : "/eleve" });
  },
});
