import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { importJobsAction } from "@/app/actions";
import { WebsiteJobSyncPanel } from "@/components/jobs/website-job-sync-panel";
import { JOB_IMPORT_TEMPLATE_CSV } from "@/lib/jobs/parse-job-import";

export default async function ImportJobsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Jobs"
        description="Sync from the Headsbase website or upload a file"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Headsbase Website Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <WebsiteJobSyncPanel />
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader><CardTitle>Upload File</CardTitle></CardHeader>
        <CardContent>
          <form action={importJobsAction} className="space-y-4">
            <div>
              <Label htmlFor="format">Format</Label>
              <select id="format" name="format" className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xlsx">Excel (.xlsx)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="file">File</Label>
              <input id="file" name="file" type="file" accept=".csv,.json,.xlsx" required className="mt-1 block w-full text-sm" />
            </div>
            <p className="text-xs text-muted-foreground">
              Required: <code>Client</code> and <code>title</code>. Also reads{" "}
              <code>Job Description</code>, <code>Openings</code>, <code>Required Skills</code>,{" "}
              <code>Pay</code>, and <code>Refferal Link</code> (referral spelling
              variants included). CSV, TSV, and Excel quotes around headers are accepted. Unknown
              clients are created from the Client column.
            </p>
            <div className="flex items-center gap-3">
              <Button type="submit">Import Jobs</Button>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(JOB_IMPORT_TEMPLATE_CSV)}`}
                download="job-import-template.csv"
                className="text-xs text-brand-700 hover:underline"
              >
                Download CSV template
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
