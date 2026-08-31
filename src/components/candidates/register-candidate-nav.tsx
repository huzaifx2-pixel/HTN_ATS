"use client";

import { useEffect } from "react";
import { saveCandidateNav } from "@/lib/candidates/search-nav";

export function RegisterCandidateNav({
  ids,
  returnTo,
  append = false,
}: {
  ids: string[];
  returnTo: string;
  append?: boolean;
}) {
  const idsKey = ids.join(",");

  useEffect(() => {
    saveCandidateNav(ids, returnTo, append ? "append" : "replace");
    // ids is captured from the render that produced idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, returnTo, append]);

  return null;
}
