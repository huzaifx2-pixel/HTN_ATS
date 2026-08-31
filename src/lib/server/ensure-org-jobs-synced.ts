import { prisma } from "@/lib/db";
import { WEBSITE_JOB_SOURCE } from "@/lib/integrations/canonical-job-mapping";
import { isOrgWebsiteJobAutoSyncEnabled, syncWebsiteJobsForOrganization } from "@/lib/services/website-job-sync-service";

const pendingSyncs = new Set<string>();

/** Import website jobs when a new org has none yet. */
export async function ensureOrgJobsSynced(organizationId: string) {
  if (!(await isOrgWebsiteJobAutoSyncEnabled(organizationId))) return;

  const [websiteJobCount, settings] = await Promise.all([
    prisma.job.count({
      where: { organizationId, source: WEBSITE_JOB_SOURCE },
    }),
    prisma.orgSettings.findUnique({
      where: { organizationId },
      select: { websiteJobLastSyncAt: true },
    }),
  ]);

  if (websiteJobCount > 0 || settings?.websiteJobLastSyncAt || pendingSyncs.has(organizationId)) {
    return;
  }

  pendingSyncs.add(organizationId);
  try {
    console.info(`[website-job-sync] Initial sync for organization ${organizationId}`);
    await syncWebsiteJobsForOrganization(organizationId);
  } catch (error) {
    console.error(`[website-job-sync] Initial sync failed for ${organizationId}`, error);
  } finally {
    pendingSyncs.delete(organizationId);
  }
}

const checkedOrgs = new Set<string>();

export function scheduleOrgJobsSynced(organizationId: string) {
  if (checkedOrgs.has(organizationId)) return;
  checkedOrgs.add(organizationId);
  void ensureOrgJobsSynced(organizationId).catch(() => {
    checkedOrgs.delete(organizationId);
  });
}
