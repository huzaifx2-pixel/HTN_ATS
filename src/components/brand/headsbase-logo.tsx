import Image from "next/image";
import Link from "next/link";
import { HEADSBASE_LOGO_LIGHT_SRC } from "@/lib/brand/assets";
import { cn } from "@/lib/utils";

export function HeadsbaseLogo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex min-w-0 items-center", collapsed ? "justify-center" : "", className)}
      aria-label="Headsbase dashboard"
    >
      {collapsed ? (
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden">
          <Image
            src={HEADSBASE_LOGO_LIGHT_SRC}
            alt="Headsbase"
            width={210}
            height={51}
            priority
            className="h-9 w-auto max-w-none shrink-0"
          />
        </span>
      ) : (
        <Image
          src={HEADSBASE_LOGO_LIGHT_SRC}
          alt="Headsbase"
          width={210}
          height={51}
          priority
          className="h-8 w-auto max-w-[148px] shrink-0 object-contain object-left"
        />
      )}
    </Link>
  );
}
