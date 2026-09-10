import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebsiteJobSyncPanel } from "@/components/jobs/website-job-sync-panel";
import { JobFileImportPanel } from "@/components/jobs/job-file-import-panel";
import { listRecentJobImportBatches } from "@/lib/jobs/csv-job-sync";

export default async function ImportJobsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  let history: Awaited<ReturnType<typeof listRecentJobImportBatches>> = [];
  try {
    history = await listRecentJobImportBatches(15);
  } catch {
    history = [];
  }

  const serializedHistory = history.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Jobs"
        description="Sync from the Headsbase website or upload a CSV/Excel file with Referral Link identity"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Headsbase Website Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <WebsiteJobSyncPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload File (CSV Sync)</CardTitle>
        </CardHeader>
        <CardContent>
          <JobFileImportPanel initialHistory={serializedHistory} />
        </CardContent>
      </Card>
    </div>
  );
}
