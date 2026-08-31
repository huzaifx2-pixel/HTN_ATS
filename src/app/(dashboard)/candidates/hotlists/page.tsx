import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listHotlists } from "@/lib/services/hotlist-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { CreateHotlistForm } from "@/components/candidates/create-hotlist-form";

export default async function HotlistsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const hotlists = await listHotlists(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader title="Candidate Hotlists" description="Curated lists recruiters use daily." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <CreateHotlistForm />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-6 space-y-2">
            {hotlists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hotlists yet. Create one like “Top Java Developers”.</p>
            ) : (
              hotlists.map((hotlist) => (
                <Link
                  key={hotlist.id}
                  href={`/candidates/hotlists/${hotlist.id}`}
                  className="block rounded-lg border px-3 py-2 hover:bg-muted/40"
                >
                  <div className="font-medium text-sm">{hotlist.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {hotlist._count.members} candidate{hotlist._count.members === 1 ? "" : "s"}
                    {hotlist.description ? ` · ${hotlist.description}` : ""}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
