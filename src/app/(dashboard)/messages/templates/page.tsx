import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import {
  listEmailTemplates,
  seedDefaultEmailTemplates,
} from "@/lib/services/email-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { CreateEmailTemplateForm } from "@/components/email/create-email-template-form";
import { EmailTemplatePreview } from "@/components/email/email-template-preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  deleteEmailTemplateAction,
} from "@/app/actions";

export default async function EmailTemplatesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  await seedDefaultEmailTemplates(member.organizationId);
  const templates = await listEmailTemplates(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates"
        description="Reusable templates for reaching out to matched candidates"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Create Template</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateEmailTemplateForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Saved Templates ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              templates.map((tpl) => (
                <div key={tpl.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground">{tpl.subject}</div>
                    </div>
                    <form action={deleteEmailTemplateAction.bind(null, tpl.id)}>
                      <Button type="submit" variant="outline" size="sm">Delete</Button>
                    </form>
                  </div>
                  <EmailTemplatePreview html={tpl.body} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
