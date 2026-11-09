import { useEffect, useRef, type ReactNode } from "react";

/** Keep answering controls in the visible area, including above the mobile keyboard. */
export function ExerciseViewport({ children, className = "", outerClassName = "" }: { children: ReactNode; className?: string; outerClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-app-header]");
    const viewport = window.visualViewport;
    const update = () => {
      const element = ref.current;
      if (!element) return;
      const offset = viewport?.offsetTop ?? 0;
      const top = Math.max(header?.getBoundingClientRect().bottom ?? 0, offset);
      element.style.top = `${top}px`;
      element.style.height = `${Math.max(0, (viewport?.height ?? window.innerHeight) + offset - top)}px`;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (header) observer?.observe(header);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer?.disconnect();
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return <div ref={ref} className={`exercise-viewport fixed inset-x-0 bottom-0 z-10 bg-background p-3 sm:p-4 ${outerClassName}`}>
    <div className={`mx-auto flex h-full min-h-0 w-full max-w-xl flex-col gap-2 ${className}`}>{children}</div>
  </div>;
}