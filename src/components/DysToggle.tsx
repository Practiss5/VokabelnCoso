import { useEffect, useState } from "react";
import { BookOpen, Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "vocab-dys-mode";

export function applyStoredDys() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dys", localStorage.getItem(KEY) === "1");
}

export function DysToggle({ prominent = false }: { prominent?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(localStorage.getItem(KEY) === "1");
  }, []);
  function toggle() {
    const next = !on;
    setOn(next);
    localStorage.setItem(KEY, next ? "1" : "0");
    document.documentElement.classList.toggle("dys", next);
  }
  return (
    <Button size="lg" variant={on ? "default" : "outline"} onClick={toggle} aria-pressed={on}
      className={`h-auto min-h-12 gap-3 whitespace-normal border-2 px-4 py-3 text-left ${prominent ? "w-full justify-between" : "justify-start"}`}
      aria-label={`Lecture facile (dyslexie) : ${on ? "activée" : "désactivée"}`}
      title="Lecture facile : police et espacements adaptés à la dyslexie">
      <BookOpen className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="font-semibold leading-snug">{prominent ? "Lecture facile (dyslexie)" : "Lecture facile"}</span>
        <span className="flex items-center gap-1.5 text-xs leading-snug">
          {on ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <Circle className="size-3.5 shrink-0" aria-hidden="true" />}
          {on ? "Activée" : "Désactivée"}
        </span>
      </span>
    </Button>
  );
}
