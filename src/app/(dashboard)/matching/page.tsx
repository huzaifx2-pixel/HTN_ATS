import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, RefreshCw, Briefcase, Send } from "lucide-react";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { resolveOrgGmailSender } from "@/lib/services/gmail-service";
import { getOutreachPoolSummary } from "@/lib/services/outreach-mailbox-service";
import { listEmailTemplates, seedDefaultEmailTemplates } from "@/lib/services/email-service";
import {
  FOLLOW_UP_AFTER_DAYS,
  MATCHING_JOBS_PAGE_SIZE,
  getFollowUpRecipientsByJob,
  getJobsWithMatchingCandidates,
  getMatchingHubSummary,
  listMatchingSentEmails,
} from "@/lib/services/match-email-outreach-service";
import { withPagePerf } from "@/lib/perf";
import { PageHeader, StatCard } from "@/components/shared/dashboard-widgets";
import { MatchingJobsTable } from "@/components/matching/matching-jobs-table";
import { MatchingFollowUpPanel } from "@/components/matching/matching-follow-up-panel";
import { MatchingSentEmailsPanel } from "@/components/matching/matching-sent-emails-panel";
import { MatchingTemplatesPanel } from "@/components/matching/matching-templates-panel";
import { MatchingQueueRefresh } from "@/components/matching/matching-queue-refresh";
import { MatchingKillSwitch, MatchingKilledBanner } from "@/components/matching/matching-kill-switch";
import { MatchingRematchButton } from "@/components/matching/matching-rematch-button";
import { getMatchingKillSwitchState } from "@/lib/matching/kill-switch";
import { cn } from "@/lib/utils";

type MatchingTab = "matches" | "follow-up" | "sent" | "templates";

function parseTab(value?: string | null): MatchingTab {
  if (value === "follow-up" || value === "sent" || value === "templates") return value;
  return "matches";
}

export default async function MatchingCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cursor?: string; search?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { tab: rawTab, cursor: rawCursor, search: rawSearch } = await searchParams;
  const tab = parseTab(rawTab);
  const matchSearch = tab === "matches" ? rawSearch?.trim() || undefined : undefined;
  const matchCursor = tab === "matches" ? rawCursor : undefined;
  const sentCursor = tab === "sent" ? rawCursor : undefined;

  const { summary, jobs, jobsNextCursor, jobsTotal, followUpGroups, sentEmails, templates, gmail, sender, killSwitch } =
    await withPagePerf("matching", async () => {
      await seedDefaultEmailTemplates(member.organizationId);
      const [hubSummary, matchJobs, followUps, sent, emailTemplates, outreach, sender, matchingSwitch] =
        await Promise.all([
          getMatchingHubSummary(member.organizationId),
          tab === "matches"
            ? getJobsWithMatchingCandidates(member.organizationId, {
                cursor: matchCursor,
                search: matchSearch,
              })
            : Promise.resolve({ items: [], nextCursor: null, total: 0 }),
          tab === "follow-up" ? getFollowUpRecipientsByJob(member.organizationId) : Promise.resolve([]),
          tab === "sent"
            ? listMatchingSentEmails(member.organizationId, { cursor: sentCursor })
            : Promise.resolve({ items: [], nextCursor: null }),
          listEmailTemplates(member.organizationId),
          getOutreachPoolSummary(member.organizationId).catch(() => ({
            delayMs: 45_000,
            pending: 0,
            mailboxCount: 0,
            dailyCapacity: 0,
            remainingToday: 0,
            sentToday: 0,
          })),
          resolveOrgGmailSender(member.organizationId, session.user.id),
          getMatchingKillSwitchState(member.organizationId),
        ]);
      return {
        summary: hubSummary,
        jobs: matchJobs.items,
        jobsNextCursor: matchJobs.nextCursor,
        jobsTotal: matchJobs.total,
        followUpGroups: followUps,
        sentEmails: sent,
        templates: emailTemplates,
        gmail: outreach,
        sender,
        killSwitch: matchingSwitch,
      };
    });

  const recruiterName = session.user.name ?? "Recruiter";
  const gmailConnected = (gmail?.mailboxCount ?? 0) > 0 || Boolean(sender);
  const outreachFromLabel = (gmail?.mailboxCount ?? 0) > 0
    ? `${gmail.mailboxCount} outreach account${gmail.mailboxCount === 1 ? "" : "s"} · ${gmail.remainingToday.toLocaleString()} remaining today`
    : sender?.email;
  const templatePayload = templates.map((template) => ({
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
  }));

  const tabs: Array<{ key: MatchingTab; label: string; count?: number }> = [
    { key: "matches", label: "Matches", count: summary.jobsWithMatches },
    { key: "follow-up", label: "Follow-up", count: summary.followUpsDue },
    { key: "sent", label: "Sent emails", count: summary.sentEmails },
    { key: "templates", label: "Templates", count: templates.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matching Candidates"
        description="Select jobs below to email those matches. Open jobs, sent emails, templates, and follow-up stay on this page."
        actions={
          <>
            <MatchingKillSwitch killed={killSwitch.killed} queued={killSwitch.queued} />
            <MatchingRematchButton killed={killSwitch.killed} />
          </>
        }
      />

      {killSwitch.killed ? <MatchingKilledBanner /> : null}
      <MatchingQueueRefresh queued={killSwitch.queued} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jobs with matches" value={summary.jobsWithMatches} icon={Briefcase} href="/matching" />
        <StatCard
          label="Ready to email"
          value={summary.remainingToEmail}
          icon={Mail}
          href="/matching"
        />
        <StatCard
          label={`Follow-up due (${FOLLOW_UP_AFTER_DAYS}d+)`}
          value={summary.followUpsDue}
          icon={RefreshCw}
          href="/matching?tab=follow-up"
        />
        <StatCard
          label="Sent emails"
          value={summary.sentEmails}
          icon={Send}
          href="/matching?tab=sent"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={item.key === "matches" ? "/matching" : `/matching?tab=${item.key}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.key
                ? "bg-brand-700 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
            {item.count != null ? ` (${item.count.toLocaleString()})` : ""}
          </Link>
        ))}
      </div>

      {tab === "matches" && (
        <MatchingJobsTable
          jobs={jobs}
          totalJobs={jobsTotal}
          nextCursor={jobsNextCursor}
          cursor={matchCursor}
          search={matchSearch}
          pageSize={MATCHING_JOBS_PAGE_SIZE}
          templates={templatePayload}
          gmailConnected={gmailConnected}
          userEmail={outreachFromLabel}
          recruiterName={recruiterName}
          matchingKilled={killSwitch.killed}
        />
      )}

      {tab === "follow-up" && (
        <MatchingFollowUpPanel
          groups={followUpGroups}
          templates={templatePayload}
          gmailConnected={gmailConnected}
          userEmail={outreachFromLabel}
          recruiterName={recruiterName}
        />
      )}

      {tab === "sent" && (
        <MatchingSentEmailsPanel
          items={sentEmails.items}
          total={summary.sentEmails}
          nextCursor={sentEmails.nextCursor}
          cursor={sentCursor}
        />
      )}

      {tab === "templates" && <MatchingTemplatesPanel templates={templatePayload} />}
    </div>
  );
}
