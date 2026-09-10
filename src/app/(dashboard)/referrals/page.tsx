import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Badge } from "@/components/ui/badge";
import {
  getReferralMetrics,
  listReferrals,
  listImportBatches,
  STAGE_LABELS,
} from "@/lib/services/micro1-referral-service";
import { ReferralHourlySyncPanel } from "@/components/referrals/referral-hourly-sync-panel";
import { ReferralImportPanel } from "@/components/referrals/referral-import-panel";
import { ReferralUnresolved } from "@/components/referrals/referral-unresolved";
import { ReferralDateSort } from "@/components/referrals/referral-date-sort";
import { ReferralDeleteButton } from "@/components/referrals/referral-delete-button";
import type { Micro1ReferralStage } from "@prisma/client";
import { cn } from "@/lib/utils";

const QUICK_FILTERS: Array<{ label: string; href: string; key: string }> = [
  { label: "All", href: "/referrals", key: "" },
  { label: "Applying", href: "/referrals?stage=APPLYING", key: "APPLYING" },
  { label: "AI Interview", href: "/referrals?stage=AI_INTERVIEW", key: "AI_INTERVIEW" },
  { label: "Certified", href: "/referrals?stage=CERTIFIED", key: "CERTIFIED" },
  { label: "Matched", href: "/referrals?stage=MATCHED", key: "MATCHED" },
  { label: "Started", href: "/referrals?stage=STARTED", key: "STARTED" },
  { label: "Successful", href: "/referrals?stage=SUCCESSFUL", key: "SUCCESSFUL" },
  { label: "Duplicate", href: "/referrals?stage=DUPLICATE", key: "DUPLICATE" },
  { label: "Matched but Not Started", href: "/referrals?stage=MATCHED_NOT_STARTED", key: "MATCHED_NOT_STARTED" },
  { label: "Unmatched / Needs Review", href: "/referrals?stage=UNRESOLVED", key: "UNRESOLVED" },
];

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function stageVariant(stage: Micro1ReferralStage) {
  if (stage === "SUCCESSFUL" || stage === "STARTED") return "success" as const;
  if (stage === "DUPLICATE") return "secondary" as const;
  if (stage === "APPLYING") return "default" as const;
  return "default" as const;
}

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    project?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const params = await searchParams;
  const stage = params.stage as
    | Micro1ReferralStage
    | "MATCHED_NOT_STARTED"
    | "UNRESOLVED"
    | undefined;
  const sort = params.sort === "referred_asc" || params.sort === "updated_asc" ? "referred_asc" : "referred_desc";
  const sortQuery = {
    q: params.q,
    stage: params.stage,
    project: params.project,
    status: params.status,
  };

  const [metrics, referrals, batches, matchQueue] = await Promise.all([
    getReferralMetrics(member.organizationId),
    listReferrals(member.organizationId, {
      q: params.q,
      stage,
      projectType: params.project,
      csvStatus: params.status,
      sort,
    }),
    listImportBatches(member.organizationId),
    listReferrals(member.organizationId, {}, 500),
  ]);

  const cards = [
    { label: "Total Referrals", value: metrics.totalReferrals },
    { label: "Duplicate", value: metrics.duplicate },
    { label: "Applying", value: metrics.applying },
    { label: "AI Interview Completed", value: metrics.aiInterview },
    { label: "Criteria Met", value: metrics.criteriaMet },
    { label: "Certified", value: metrics.certified },
    { label: "Matched to Project", value: metrics.matched },
    { label: "Started", value: metrics.started },
    { label: "Successful", value: metrics.successful },
    { label: "Total Cash Earned", value: money(metrics.totalCashEarned) },
    { label: "Available Balance", value: money(metrics.availableBalance) },
    { label: "Paid", value: money(metrics.paid) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="micro1 Referral Tracking"
        description="Hourly signed-in scrape from micro1, plus CSV fallback. Match candidates and track referral progress."
      />

      <p className="text-sm text-muted-foreground">
        {metrics.lastSync?.lastSyncAt ? (
          <>
            Last auto-sync:{" "}
            {metrics.lastSync.lastSyncAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {metrics.lastSync.lastSyncError ? ` · ${metrics.lastSync.lastSyncError}` : ""}
            {" · "}
          </>
        ) : null}
        {metrics.lastImport ? (
          <>
            Last import:{" "}
            {metrics.lastImport.createdAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {metrics.lastImport.validCount} rows in the latest file. Total Referrals is every unique
            person stored from all imports, not that file size. Stage cards are current status only
            (they add up to Total). Hourly signed-in scrape keeps Applying and status changes current.
          </>
        ) : (
          "No imports yet"
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</div>
            <div className="text-lg font-semibold tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={
              sort === "referred_asc"
                ? filter.href.includes("?")
                  ? `${filter.href}&sort=referred_asc`
                  : `${filter.href}?sort=referred_asc`
                : filter.href
            }
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              (params.stage ?? "") === filter.key
                ? "border-brand-700 bg-[#2563eb] text-white"
                : "border-border bg-white text-muted-foreground hover:bg-muted",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-2" action="/referrals">
        {params.stage ? <input type="hidden" name="stage" value={params.stage} /> : null}
        {sort === "referred_asc" ? <input type="hidden" name="sort" value="referred_asc" /> : null}
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search CSV name, ATS name, status, project, transaction ID"
          className="h-10 min-w-[280px] flex-1 rounded-lg border border-border bg-card px-3 text-sm"
        />
        <button type="submit" className="rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Referral Stage</th>
                <th className="px-3 py-2">micro1 Status</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">
                  <ReferralDateSort value={sort === "referred_asc" ? "asc" : "desc"} query={sortQuery} />
                </th>
                <th className="px-3 py-2">Tasks</th>
                <th className="px-3 py-2">Hours</th>
                <th className="px-3 py-2">Payout</th>
              </tr>
            </thead>
            <tbody>
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No referral records yet. Import a micro1 CSV to get started.
                  </td>
                </tr>
              ) : (
                referrals.map((row) => {
                  const archived = Boolean(row.candidate?.deletedAt);
                  const linked = Boolean(row.candidateId && row.matchingStatus === "MATCHED");
                  const displayName = linked
                    ? `${row.candidate?.firstName ?? ""} ${row.candidate?.lastName ?? ""}`.trim() || row.csvName
                    : row.csvName;
                  return (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {linked && !archived ? (
                            <Link href={`/candidates/${row.candidateId}?tab=referral`} className="text-[#1e4e8c] hover:underline">
                              {displayName}
                            </Link>
                          ) : (
                            <span className={linked ? "text-muted-foreground" : "text-red-700"}>{displayName}</span>
                          )}
                          {archived ? (
                            <Badge variant="secondary">
                              Archived candidate
                            </Badge>
                          ) : null}
                          <ReferralDeleteButton referralId={row.id} name={displayName} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={stageVariant(row.stage)}>{STAGE_LABELS[row.stage]}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.csvStatus}</td>
                      <td className="px-3 py-2">{row.projectType ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {row.dateReferred
                          ? row.dateReferred.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{row.tasksCompleted ?? "—"}</td>
                      <td className="px-3 py-2">{row.hoursWorked != null ? Number(row.hoursWorked) : "—"}</td>
                      <td className="px-3 py-2">
                        {row.payoutAmount != null ? money(Number(row.payoutAmount)) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <ReferralHourlySyncPanel
            settings={{
              enabled: metrics.lastSync?.enabled ?? false,
              email: metrics.lastSync?.email ?? "",
              hasSession: metrics.lastSync?.hasSession ?? false,
              lastSyncAt: metrics.lastSync?.lastSyncAt?.toISOString() ?? null,
              lastSyncError: metrics.lastSync?.lastSyncError ?? null,
            }}
          />
          <ReferralImportPanel
            history={batches.map((batch) => ({
              id: batch.id,
              fileName: batch.fileName,
              status: batch.status,
              createdAt: batch.createdAt.toISOString(),
              totalRows: batch.totalRows,
              validCount: batch.validCount,
              invalidCount: batch.invalidCount,
              matched: batch.matched,
              unmatched: batch.unmatched,
              needsReview: batch.needsReview,
              statusChanges: batch.statusChanges,
              errorMessage: batch.errorMessage,
            }))}
          />
          <ReferralUnresolved
            rows={matchQueue.map((row) => ({
              id: row.id,
              csvName: row.csvName,
              matchingStatus: row.matchingStatus,
              matchingConfidence: row.matchingConfidence,
              matchingReason: row.matchingReason,
              suggested:
                row.suggestedCandidate
                  ? {
                      id: row.suggestedCandidate.id,
                      name: `${row.suggestedCandidate.firstName} ${row.suggestedCandidate.lastName}`,
                    }
                  : null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
