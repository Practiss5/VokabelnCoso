import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vocabulaire Allemand — réviser en classe" },
      { name: "description", content: "Listes de vocabulaire allemand-français, trois modes de révision et répétition espacée pour les élèves." },
      { property: "og:title", content: "Vocabulaire Allemand" },
      { property: "og:description", content: "Réviser le vocabulaire allemand avec sa classe, sur ordinateur ou téléphone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="paper-lines min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Deutsch · Français</p>
        <h1 className="mt-3 text-5xl font-bold leading-tight sm:text-7xl">
          Vocabulaire <span className="bg-accent px-2">Allemand</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Les enseignants préparent les listes, les élèves révisent avec des cartes, un QCM ou en écrivant.
          Les mots ratés reviennent plus souvent.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link to="/auth">Se connecter</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth" search={{ mode: "signup" }}>Créer un compte élève</Link></Button>
        </div>
      </div>
    </main>
  );
}
