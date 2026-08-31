"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES = ["/dashboard", "/candidates", "/jobs", "/candidates/inbox", "/messages"];

export function PrefetchRoutes() {
  const router = useRouter();

  useEffect(() => {
    for (const route of ROUTES) {
      router.prefetch(route);
    }
  }, [router]);

  return null;
}
