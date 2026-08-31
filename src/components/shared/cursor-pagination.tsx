import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CursorPaginationProps = {
  nextCursor?: string | null;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  pageSize?: number;
  total?: number;
  totalCapped?: boolean;
  shown?: number;
};

export function CursorPagination({
  nextCursor,
  basePath,
  searchParams = {},
  pageSize = 50,
  total,
  totalCapped,
  shown,
}: CursorPaginationProps) {
  const buildHref = (cursor?: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <span>
        {total != null && shown != null
          ? `Showing ${shown} of ${total.toLocaleString()}${totalCapped || nextCursor ? "+" : ""}`
          : shown != null && nextCursor
            ? `Showing ${shown} — more available`
            : shown != null
              ? `Showing ${shown} results`
              : null}
      </span>
      <div className="flex gap-2">
        {searchParams.cursor && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref()}>First page</Link>
          </Button>
        )}
        {nextCursor ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(nextCursor)}>Load next {pageSize}</Link>
          </Button>
        ) : (
          <span className={cn("self-center px-2", !searchParams.cursor && "hidden")}>End of list</span>
        )}
      </div>
    </div>
  );
}
