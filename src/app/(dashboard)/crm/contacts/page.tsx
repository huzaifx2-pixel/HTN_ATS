import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listCrmContacts } from "@/lib/services/crm-service";
import { listClients } from "@/lib/services/client-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { CreateCrmContactForm } from "@/components/crm/create-crm-contact-form";

export default async function CrmContactsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const [contacts, clients] = await Promise.all([
    listCrmContacts(member.organizationId),
    listClients(member.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="CRM Contacts" description="Hiring managers and decision makers — separate from candidates." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardContent className="pt-6"><CreateCrmContactForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} /></CardContent></Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-6 space-y-2">
            {contacts.map((contact) => (
              <div key={contact.id} className="rounded-lg border px-3 py-2">
                <div className="font-medium text-sm">{contact.firstName} {contact.lastName}</div>
                <div className="text-xs text-muted-foreground">
                  {[contact.title, contact.email, contact.client?.name].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
