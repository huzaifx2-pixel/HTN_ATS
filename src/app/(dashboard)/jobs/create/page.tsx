import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listClients } from "@/lib/services/client-service";
import { getJobTemplate } from "@/lib/services/job-template-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createJobAction } from "@/app/actions";
import { BooleanSearchEditor } from "@/components/jobs/boolean-search-editor";

export default async function CreateJobPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { templateId } = await searchParams;
  const template = templateId
    ? await getJobTemplate(member.organizationId, templateId)
    : null;
  if (templateId && !template) notFound();

  const clients = await listClients(member.organizationId);
  const requirements = (template?.requirements as { skills?: string[]; experienceYears?: number } | null) ?? {};
  const skillsValue = requirements.skills?.join(", ") ?? "";

  return (
    <div>
      <PageHeader
        title={template ? `Create Job from “${template.name}”` : "Create Job"}
        description={template ? "Template fields are pre-filled — choose a client and adjust as needed" : "Add a new job requisition"}
      />
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createJobAction} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="clientId">Client</Label>
                <Link href="/admin/clients" className="text-xs text-brand-700 hover:underline font-medium">
                  + Add Client
                </Link>
              </div>
              <select id="clientId" name="clientId" required className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.prefix})</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="title">Job Title</Label>
              <Input id="title" name="title" required defaultValue={template?.title ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={template?.description ?? ""}
                className="mt-1 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={template?.location ?? ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="openings">Openings</Label>
                <Input id="openings" name="openings" type="number" defaultValue={1} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="skills">Required Skills (comma-separated)</Label>
              <Input id="skills" name="skills" placeholder="Java, Spring Boot, AWS" defaultValue={skillsValue} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="experienceYears">Experience (years)</Label>
              <Input
                id="experienceYears"
                name="experienceYears"
                type="number"
                defaultValue={requirements.experienceYears ?? template?.experienceMin ?? undefined}
                className="mt-1"
              />
            </div>
            <BooleanSearchEditor
              defaultValue={template?.booleanSearch ?? ""}
              titleInputId="title"
              descriptionInputId="description"
              skillsInputId="skills"
            />
            <div>
              <Label htmlFor="referralLink">Apply Link (optional)</Label>
              <Input
                id="referralLink"
                name="referralLink"
                type="url"
                placeholder="Leave blank to auto-generate after creation"
                className="mt-1"
              />
            </div>
            <Button type="submit">Create Job</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
