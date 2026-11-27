import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Bouton « Installer l'application » : invite native (Android, Edge, Chrome) ou marche à suivre (iPhone, Safari). */
export function InstallApp() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);
  // Visible seulement sur l'accueil, la connexion et les tableaux de bord : jamais pendant un exercice.
  const path = useRouterState({ select: (st) => st.location.pathname }).replace(/\/$/, "") || "/";
  const allowed = ["/", "/auth", "/eleve", "/enseignant"].includes(path);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const inFrame = window.self !== window.top;
    setInstalled(standalone || inFrame);
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !allowed) return null;

  async function click() {
    if (evt) {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setEvt(null);
    } else setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={click}
        className="fixed bottom-3 left-3 z-40 flex items-center gap-2 rounded-full border-2 border-border bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden">
        <Download className="size-4" aria-hidden="true" /> Installer l'application
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Installer l'application</DialogTitle>
            <DialogDescription>L'application s'ouvrira depuis une icône, comme une vraie appli.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section className={ios ? "" : "opacity-80"}>
              <h3 className="font-semibold">iPhone / iPad (Safari)</h3>
              <ol className="ml-5 list-decimal space-y-1">
                <li>Ouvre le site dans <b>Safari</b>.</li>
                <li>Touche le bouton <b>Partager</b> (carré avec une flèche vers le haut).</li>
                <li>Choisis <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li>
              </ol>
            </section>
            <section>
              <h3 className="font-semibold">Safari sur Mac</h3>
              <p>Menu <b>Fichier → Ajouter au Dock</b> (ou bouton Partager → « Ajouter au Dock »).</p>
            </section>
            <section>
              <h3 className="font-semibold">Android, Edge, Chrome</h3>
              <p>Menu <b>⋮</b> → <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>. Pas en navigation privée. Si rien n'apparaît, l'application est peut-être déjà installée.</p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
