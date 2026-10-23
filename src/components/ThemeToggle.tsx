import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";

const KEY = "vocab-dark-mode";

export function applyStoredTheme() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", localStorage.getItem(KEY) === "1");
}

/** Bouton contraste (◐) fixé en haut à gauche de chaque page. */
export function ThemeToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(localStorage.getItem(KEY) === "1");
  }, []);
  function toggle() {
    const next = !on;
    setOn(next);
    localStorage.setItem(KEY, next ? "1" : "0");
    document.documentElement.classList.toggle("dark", next);
  }
  const label = on ? "Passer en mode clair" : "Passer en mode sombre";
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={label} title={label}
      className="fixed left-3 top-3 z-50 flex size-11 items-center justify-center rounded-full border-2 border-border bg-card text-foreground shadow-md transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Contrast className={`size-6 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
  );
}
