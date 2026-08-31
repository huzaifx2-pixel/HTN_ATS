import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listJobTemplates } from "@/lib/services/job-template-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { JobTemplatesList } from "@/components/jobs/job-templates-list";
import { Button } from "@/components/ui/button";

export default async function JobTemplatesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const templates = await listJobTemplates(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Templates"
        description="Reusable job description templates — create from any job overview page"
        actions={
          <Button asChild variant="outline">
            <Link href="/jobs">Browse jobs</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <JobTemplatesList
            templates={templates.map((template) => ({
              id: template.id,
              name: template.name,
              title: template.title,
              updatedAt: template.updatedAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
