import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "vocab-dys-mode";

export function applyStoredDys() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dys", localStorage.getItem(KEY) === "1");
}

export function DysToggle() {
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
    <Button size="sm" variant={on ? "default" : "outline"} onClick={toggle} aria-pressed={on}
      title="Police et espacements plus lisibles pour les élèves dys">
      Mode DYS {on ? "activé" : ""}
    </Button>
  );
}
