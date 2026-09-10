"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MemberRole } from "@prisma/client";
import { canAccessPath, firstAccessibleHref } from "@/lib/auth/features";

export function FeatureRouteGuard({
  role,
  features,
}: {
  role: MemberRole;
  features: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    if (canAccessPath(pathname, features, role)) return;
    router.replace(firstAccessibleHref(features, role));
  }, [pathname, features, role, router]);

  return null;
}
