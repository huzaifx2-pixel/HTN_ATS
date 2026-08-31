import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { universalSearch } from "@/lib/services/universal-search-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchForm } from "@/components/search/search-form";
import { previewHref } from "@/lib/preview-href";
import { withPagePerf } from "@/lib/perf";

const TYPE_LABELS: Record<string, string> = {
  candidate: "Candidates",
  job: "Jobs",
  client: "Companies",
  contact: "CRM Contacts",
  campaign: "Campaigns",
  hotlist: "Hotlists",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Universal Search"
          description="Search across candidates, jobs, companies, CRM contacts, campaigns, and hotlists."
        />
        <SearchForm autoFocus />
        <p className="text-sm text-muted-foreground">
          Tip: press <kbd className="rounded border px-1 text-xs">/</kbd> anywhere to focus the top search bar.
        </p>
      </div>
    );
  }

  const results = await withPagePerf("search", () =>
    universalSearch(member.organizationId, query, 40),
  );

  const grouped = Object.entries(
    results.reduce<Record<string, typeof results>>((acc, result) => {
      acc[result.type] = acc[result.type] ?? [];
      acc[result.type].push(result);
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Results for “${query}”`}
        description={`${results.length} result${results.length === 1 ? "" : "s"} across your workspace`}
      />

      <SearchForm initialQuery={query} />

      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches found. Try a different keyword.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {grouped.map(([type, items]) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="text-sm">{TYPE_LABELS[type] ?? type} ({items.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                    <Link href={item.href} className="min-w-0 hover:text-brand-700">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    </Link>
                    {(item.type === "candidate" || item.type === "job" || item.type === "client") && (
                      <Link
                        href={previewHref(item.type, item.id, "/search")}
                        className="text-xs text-brand-700 hover:underline whitespace-nowrap"
                      >
                        Preview
                      </Link>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
