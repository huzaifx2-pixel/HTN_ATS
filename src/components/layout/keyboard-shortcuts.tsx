"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "g") {
        const handler = (next: KeyboardEvent) => {
          window.removeEventListener("keydown", handler);
          if (next.key === "j") {
            next.preventDefault();
            router.push("/jobs");
          } else if (next.key === "c") {
            next.preventDefault();
            router.push("/candidates");
          } else if (next.key === "m") {
            next.preventDefault();
            router.push("/marketing");
          }
        };
        window.addEventListener("keydown", handler, { once: true });
        setTimeout(() => window.removeEventListener("keydown", handler), 1500);
      }

      if (event.key === "n" && event.shiftKey) {
        event.preventDefault();
        router.push("/jobs/create");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
