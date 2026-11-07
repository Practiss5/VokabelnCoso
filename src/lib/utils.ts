import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Natural order for student labels: "2" before "10", numbers before names. */
export function compareStudentLabels(a: string, b: string) {
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
}
