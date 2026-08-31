import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listClients } from "@/lib/services/client-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClientAction } from "@/app/actions";
import Link from "next/link";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { client: highlightedClientId } = await searchParams;
  const clients = await listClients(member.organizationId);

  return (
    <div>
      <PageHeader title="Clients" description="Manage client companies and job ID prefixes" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Add Client</CardTitle></CardHeader>
          <CardContent>
            <form action={createClientAction} className="space-y-3">
              <div><Label htmlFor="name">Client Name</Label><Input id="name" name="name" required className="mt-1" placeholder="Microsoft" /></div>
              <div><Label htmlFor="prefix">Prefix (Job ID)</Label><Input id="prefix" name="prefix" required maxLength={5} className="mt-1 font-mono" placeholder="MIC" /></div>
              <Button type="submit" size="sm">Add Client</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Clients ({clients.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {clients.map((c) => (
              <div
                key={c.id}
                id={c.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  highlightedClientId === c.id ? "border-brand-700 bg-brand-50/40" : ""
                }`}
              >
                <div>
                  <div className="font-medium text-sm">
                    <Link href={`/admin/clients/${c.id}`} className="hover:underline text-brand-700">
                      {c.name}
                    </Link>
                  </div>
                  <div className="text-xs font-mono text-brand-700">{c.prefix}-XXX</div>
                </div>
                <span className="text-xs text-muted-foreground">{c._count.jobs} jobs</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
