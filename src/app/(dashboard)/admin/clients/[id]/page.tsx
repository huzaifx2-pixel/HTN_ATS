import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getClientProfile } from "@/lib/services/crm-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const client = await getClientProfile(id, member.organizationId);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={[client.industry, client.headquarters, client.website].filter(Boolean).join(" · ")}
        actions={
          <Link href="/admin/clients" className="text-sm text-brand-700 hover:underline">
            All companies
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{client._count.jobs}</div><div className="text-xs text-muted-foreground">Jobs</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{client.placements}</div><div className="text-xs text-muted-foreground">Placements</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{client._count.crmContacts}</div><div className="text-xs text-muted-foreground">Contacts</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{client._count.opportunities}</div><div className="text-xs text-muted-foreground">Opportunities</div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Jobs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {client.jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="block text-sm text-brand-700 hover:underline">
                {job.jobCode} · {job.title} ({job.status})
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">CRM Contacts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {client.crmContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
            ) : (
              client.crmContacts.map((contact) => (
                <div key={contact.id} className="text-sm">
                  {contact.firstName} {contact.lastName}
                  <span className="text-muted-foreground"> · {contact.title ?? contact.email}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
