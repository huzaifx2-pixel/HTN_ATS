import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getJob, getJobActivitiesWithActors } from "@/lib/services/job-service";
import { listClients } from "@/lib/services/client-service";
import { getJobApplications, getJobMatches, getJobMatchScoreBuckets, promoteEmailedMatchesToApplicants } from "@/lib/services/pipeline-service";
import { getEmailCampaignStats, listEmailTemplates, seedDefaultEmailTemplates } from "@/lib/services/email-service";
import { resolveOrgGmailSender } from "@/lib/services/gmail-service";
import { getOutreachPoolSummary } from "@/lib/services/outreach-mailbox-service";
import { getOrgMembers } from "@/lib/services/analytics-service";
import { listJobNotes, listJobDocuments } from "@/lib/services/job-note-service";
import { MatchCandidateEmail } from "@/components/jobs/match-candidate-email";
import { MatchBulkEmail } from "@/components/jobs/match-bulk-email";
import { DismissMatchButton } from "@/components/jobs/dismiss-match-button";
import { MatchingRematchButton } from "@/components/matching/matching-rematch-button";
import { MatchAnalysisPanel } from "@/components/jobs/match-analysis-panel";
import { MatchWhySummary, type MatchWhyData, hasBooleanLocationBreakdown } from "@/components/jobs/match-why-summary";
import { getJobReferralUrl, formatJobTimestamp } from "@/lib/utils";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { MatchScoreBadge, StageBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PipelineKanban } from "@/components/jobs/pipeline-kanban";
import { formatDistanceToNow } from "date-fns";
import { ReferralLinkCopy } from "@/components/jobs/referral-link-copy";
import { getSalaryPeriodFromMetadata } from "@/lib/constants/salary-periods";
import { formatJobLocation, formatJobSalary, getJobSalaryFields, resolveJobDisplayDate } from "@/lib/format-job";
import { BooleanSearchEditor } from "@/components/jobs/boolean-search-editor";
import { addCandidateToJobAction } from "@/app/actions";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import { SaveJobTemplateForm } from "@/components/jobs/save-job-template-form";
import { LinkedInMatchesPanel } from "@/components/jobs/linkedin-matches-panel";
import { MatchingChannelTabs, parseMatchingChannel } from "@/components/jobs/matching-channel-tabs";
import { getJobAnalytics } from "@/lib/services/job-analytics-service";
import { JobAnalyticsPanel } from "@/components/jobs/job-analytics-panel";
import { JobDetailHeader } from "@/components/jobs/detail/job-detail-header";
import { JobDetailForm } from "@/components/jobs/detail/job-detail-form";
import { JobOverviewPanel } from "@/components/jobs/detail/job-overview-panel";
import { JobNotesPanel } from "@/components/jobs/detail/job-notes-panel";
import { JobDocumentsPanel } from "@/components/jobs/detail/job-documents-panel";
import { formatActivityAction } from "@/lib/activity/format";

function normalizeTab(rawTab: string) {
  if (rawTab === "candidates") return "applicants";
  if (rawTab === "settings") return "edit";
  if (rawTab === "attachments") return "documents";
  if (rawTab === "audit" || rawTab === "audit-trail") return "activity";
  return rawTab;
}

function candidateLocation(candidate: {
  city?: string | null;
  location?: string | null;
  country?: string | null;
}) {
  return [candidate.city, candidate.location, candidate.country].filter(Boolean).join(", ") || null;
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ tab?: string; cursor?: string; channel?: string }>;
}) {
  const { jobId } = await params;
  const { tab: rawTab = "overview", cursor, channel: rawChannel } = await searchParams;
  const tab = normalizeTab(rawTab);
  const matchingChannel = parseMatchingChannel(rawChannel);
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const job = await getJob(jobId.trim(), member.organizationId);
  if (!job) notFound();

  const needsApplications = tab === "applicants" || tab === "pipeline" || tab === "overview";
  const needsInternalMatches = tab === "matching" && matchingChannel === "internal";
  const needsMatchBuckets = tab === "overview";
  const needsActivities = tab === "activity" || tab === "overview";
  const needsClients = tab === "edit";
  const needsMembers = tab === "edit";
  const needsEmail = tab === "email" || (tab === "matching" && matchingChannel === "internal");
  const needsEmailTemplates = needsEmail || tab === "edit";
  const needsAnalytics = tab === "analytics";
  const needsNotes = tab === "notes";
  const needsDocuments = tab === "documents";

  if (tab === "matching" && matchingChannel === "internal") {
    await promoteEmailedMatchesToApplicants(jobId, member.organizationId);
  }

  const [
    applications,
    matches,
    matchBuckets,
    activities,
    emailStats,
    clients,
    gmail,
    outreach,
    jobAnalytics,
    orgMembers,
    notes,
    documents,
  ] = await Promise.all([
    needsApplications ? getJobApplications(jobId, member.organizationId) : Promise.resolve([]),
    needsInternalMatches
      ? getJobMatches(jobId, member.organizationId, { cursor })
      : Promise.resolve({ items: [], total: 0, nextCursor: undefined as string | undefined, rematchQueued: false }),
    needsMatchBuckets
      ? getJobMatchScoreBuckets(jobId, member.organizationId)
      : Promise.resolve({ total: 0, high: 0, medium: 0, low: 0, goodMatchPercent: 0 }),
    needsActivities
      ? getJobActivitiesWithActors(jobId, member.organizationId)
      : Promise.resolve([]),
    tab === "email" ? getEmailCampaignStats(jobId, member.organizationId) : Promise.resolve(null),
    needsClients ? listClients(member.organizationId) : Promise.resolve([]),
    needsEmail ? resolveOrgGmailSender(member.organizationId, session.user.id) : Promise.resolve(null),
    needsEmail ? getOutreachPoolSummary(member.organizationId) : Promise.resolve(null),
    needsAnalytics ? getJobAnalytics(jobId, member.organizationId) : Promise.resolve(null),
    needsMembers ? getOrgMembers(member.organizationId) : Promise.resolve([]),
    needsNotes ? listJobNotes(jobId, member.organizationId) : Promise.resolve([]),
    needsDocuments ? listJobDocuments(jobId, member.organizationId) : Promise.resolve([]),
  ]);

  let emailTemplates: Awaited<ReturnType<typeof listEmailTemplates>> = [];
  if (needsEmailTemplates) {
    await seedDefaultEmailTemplates(member.organizationId);
    emailTemplates = await listEmailTemplates(member.organizationId, jobId);
  }

  const requirements = (job.requirements as {
    skills?: string[];
    preferredSkills?: string[];
    certifications?: string[];
    experienceYears?: number;
  } | null) ?? {};
  const jobSkills = requirements.skills ?? [];
  const preferredSkills =
    requirements.preferredSkills ??
    (job.preferredQualifications
      ? job.preferredQualifications.split(",").map((s) => s.trim()).filter(Boolean)
      : []);
  const certifications = requirements.certifications ?? [];
  const experienceYears = requirements.experienceYears ?? job.experienceMin ?? undefined;
  const salaryPeriod = getSalaryPeriodFromMetadata(job.metadata);
  const jobLocation = formatJobLocation(job);
  const jobSalary = formatJobSalary(getJobSalaryFields(job));
  const applyUrl = getJobReferralUrl(job);

  const membersForForm = orgMembers.map((m) => ({
    id: m.user.id,
    name: m.user.name || m.user.email || "Member",
  }));

  const inReview = applications.filter((a) =>
    ["APPLYING", "INTERVIEW_COMPLETED"].includes(a.stage),
  ).length;
  const shortlisted = applications.filter((a) =>
    ["MCC", "CERTIFIED", "MATCHED_TO_PROJECT"].includes(a.stage),
  ).length;
  const hired = applications.filter((a) => a.stage === "PLACEMENT").length;
  const totalApplicants = applications.length || job._count.applications;

  const postedDate = resolveJobDisplayDate(job) ?? job.createdAt;
  const postedLabel = postedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const experienceLevel = (() => {
    if (job.experienceMin != null && job.experienceMax != null) {
      return `${job.experienceMin} - ${job.experienceMax} years`;
    }
    if (job.experienceMin != null) return `${job.experienceMin}+ years`;
    if (experienceYears != null) return `${experienceYears}+ years`;
    return "—";
  })();

  const employmentLabel = job.employmentType
    ? job.employmentType.replaceAll("_", " ")
    : "—";
  const workplaceSuffix = job.workplaceType
    ? ` (${job.workplaceType.replaceAll("_", " ")})`
    : "";
  const locationWithWorkplace =
    jobLocation && jobLocation !== "—"
      ? `${jobLocation}${workplaceSuffix}`
      : workplaceSuffix.trim() || "—";

  const salaryDisplay =
    jobSalary === "Competitive" ? "Not Disclosed" : jobSalary;

  const pipelineApps = applications.map((a) => ({
    id: a.id,
    stage: a.stage,
    candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`,
    currentRole: a.candidate.currentRole,
    location: candidateLocation(a.candidate),
    updatedLabel: formatDistanceToNow(a.updatedAt, { addSuffix: true }),
  }));

  return (
    <div className="space-y-6 pb-8">
      <JobDetailHeader
        jobId={jobId}
        title={job.title}
        status={job.status}
        jobCode={job.jobCode}
        clientId={job.clientId}
        clientName={job.client.name}
        location={locationWithWorkplace}
        employmentType={job.employmentType}
        postedLabel={postedLabel}
        shareUrl={applyUrl}
        activeTab={tab === "email" ? "analytics" : tab}
      />

      {tab === "overview" && (
        <JobOverviewPanel
          jobId={jobId}
          details={{
            jobId: job.id,
            department: job.department?.trim() || "—",
            experienceLevel,
            salaryRange: salaryDisplay,
            employmentType: employmentLabel,
            location: locationWithWorkplace,
            openings: job.openings,
            postedOn: postedLabel,
          }}
          description={job.description}
          responsibilities={job.responsibilities}
          requirementsText={job.requirementsText}
          preferredQualifications={job.preferredQualifications}
          skills={jobSkills}
          candidates={{
            total: totalApplicants,
            inReview,
            shortlisted,
            hired,
          }}
          matches={matchBuckets}
          activities={activities}
        />
      )}

      {tab === "email" && emailStats && (
        <div className="space-y-4">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-sm">Email Performance</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Sent:</span> {emailStats.sent}
              </div>
              <div>
                <span className="text-muted-foreground">Delivered:</span> {emailStats.delivered}
              </div>
              <div>
                <span className="text-muted-foreground">Opened:</span> {emailStats.opened}
              </div>
              <div>
                <span className="text-muted-foreground">Clicked:</span> {emailStats.clicked}
              </div>
              <div>
                <span className="text-muted-foreground">Replied:</span> {emailStats.replied}
              </div>
            </CardContent>
          </Card>
          {emailStats.recent && emailStats.recent.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sent Emails</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {emailStats.recent.map((msg) => (
                  <div key={msg.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{msg.recipientName || msg.recipientEmail}</div>
                      <div className="text-xs text-muted-foreground">{msg.subject}</div>
                      {msg.autoSent && <span className="text-[10px] text-brand-700">Auto-sent</span>}
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      {msg.sentAt ? formatDistanceToNow(msg.sentAt, { addSuffix: true }) : "—"}
                      {msg.openedAt && <div>Opened {formatDistanceToNow(msg.openedAt, { addSuffix: true })}</div>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "matching" && (
        <div>
          <MatchingChannelTabs jobId={jobId} channel={matchingChannel} />

          {matchingChannel === "linkedin" ? (
            <LinkedInMatchesPanel jobId={jobId} hasBoolean={Boolean(job.booleanSearch?.trim())} />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-sm">Matching Candidates</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Remaining pool — showing {matches.items.length}
                    {matches.total > matches.items.length ? ` of ${matches.total}` : ""} candidates. Matches are based
                    on Boolean search only. Strong+ matches (70+) are eligible for Email all. Emailed
                    matches move to Applicants.
                  </p>
                  {matches.rematchQueued ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Refreshing this list with Boolean search only. Reload in a minute to see updated scores.
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MatchingRematchButton jobId={jobId} jobTitle={job.title} />
                  {matches.total > 0 && (
                    <MatchBulkEmail
                      jobId={jobId}
                      remainingCount={matches.total}
                      jobTitle={job.title}
                      jobCode={job.jobCode}
                      clientName={job.client.name}
                      jobLocation={jobLocation}
                      jobSalary={jobSalary}
                      applyLink={applyUrl}
                      recruiterName={session.user.name ?? "Recruiter"}
                      templates={emailTemplates}
                      gmailConnected={(outreach?.mailboxCount ?? 0) > 0}
                      userEmail={
                        (outreach?.mailboxCount ?? 0) > 0
                          ? `${outreach!.mailboxCount} outreach account${outreach!.mailboxCount === 1 ? "" : "s"} · ${outreach!.remainingToday.toLocaleString()} remaining today`
                          : gmail?.email
                      }
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{jobLocation}</span>
                  {" · "}
                  <span className="font-medium text-foreground">{jobSalary}</span>
                </p>
                <div className="space-y-3">
                  {matches.items.length === 0 ? (
                    <EmptyState
                      title="No remaining matches"
                      description="Potential matches (score 60+) appear here after rematch. Emailed candidates move to Applicants."
                    />
                  ) : (
                    matches.items.map((m) => (
                      <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <Link
                            href={`/candidates/${m.candidateId}`}
                            className="text-sm font-medium text-brand-700 hover:underline"
                          >
                            {m.candidate.firstName} {m.candidate.lastName}
                          </Link>
                          <div className="text-xs text-muted-foreground">{m.candidate.currentRole}</div>
                          <MatchWhySummary
                            data={{
                              matchStatus: m.matchStatus,
                              confidence: m.confidence,
                              requirementBreakdown: (m.requirementBreakdown ??
                                null) as MatchWhyData["requirementBreakdown"],
                            }}
                          />
                          <MatchAnalysisPanel
                            jobId={jobId}
                            candidateId={m.candidateId}
                            candidateName={`${m.candidate.firstName} ${m.candidate.lastName}`}
                          />
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                          <div className="flex items-start gap-1">
                            <MatchScoreBadge score={m.score} status={m.matchStatus} />
                            <DismissMatchButton
                              jobId={jobId}
                              candidateId={m.candidateId}
                              candidateName={`${m.candidate.firstName} ${m.candidate.lastName}`.trim()}
                            />
                          </div>
                          {hasBooleanLocationBreakdown(
                            (m.requirementBreakdown ?? null) as MatchWhyData["requirementBreakdown"],
                          ) ? (
                            <div className="text-[10px] text-muted-foreground">
                              Boolean {m.skillsMatch}%
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground">
                              Rematch to refresh Boolean score
                            </div>
                          )}
                          <div className="flex gap-2">
                            <MatchCandidateEmail
                              jobId={jobId}
                              candidateId={m.candidateId}
                              candidateName={`${m.candidate.firstName} ${m.candidate.lastName}`}
                              candidateEmail={m.candidate.email}
                              jobTitle={job.title}
                              jobCode={job.jobCode}
                              clientName={job.client.name}
                              jobLocation={jobLocation}
                              jobSalary={jobSalary}
                              applyLink={applyUrl}
                              recruiterName={session.user.name ?? "Recruiter"}
                              templates={emailTemplates}
                              gmailConnected={!!gmail || (outreach?.mailboxCount ?? 0) > 0}
                              userEmail={
                                (outreach?.mailboxCount ?? 0) > 0
                                  ? `${outreach!.mailboxCount} outreach account${outreach!.mailboxCount === 1 ? "" : "s"}`
                                  : gmail?.email
                              }
                            />
                            <form action={addCandidateToJobAction.bind(null, jobId, m.candidateId)}>
                              <Button type="submit" size="sm" variant="outline">
                                Add to job
                              </Button>
                            </form>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <CursorPagination
                  nextCursor={matches.nextCursor}
                  basePath={`/jobs/${jobId}`}
                  searchParams={{ tab: "matching", channel: "internal", cursor }}
                  pageSize={50}
                  total={matches.total}
                  shown={matches.items.length}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "pipeline" && <PipelineKanban jobId={jobId} applications={pipelineApps} />}

      {tab === "analytics" && jobAnalytics && <JobAnalyticsPanel analytics={jobAnalytics} />}

      {tab === "activity" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {activities.length === 0 ? (
              <EmptyState title="No activity yet" description="Job events will appear here" />
            ) : (
              activities.map((a) => (
                <div key={a.id} className="border-b pb-2 text-sm">
                  <span className="font-medium">
                    {a.actor?.name ? `${a.actor.name} · ` : ""}
                    {formatActivityAction(a.action, a.metadata)}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "notes" && <JobNotesPanel jobId={jobId} notes={notes} />}

      {tab === "documents" && <JobDocumentsPanel documents={documents} />}

      {tab === "edit" && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="text-sm">Edit Job</CardTitle>
          </CardHeader>
          <CardContent>
            <JobDetailForm
              jobId={jobId}
              job={job}
              clients={clients}
              members={membersForForm}
              salaryPeriod={salaryPeriod}
              requiredSkills={jobSkills.join(", ")}
              preferredSkills={preferredSkills.join(", ")}
              certifications={certifications.join(", ")}
              experienceYears={experienceYears}
            >
              <BooleanSearchEditor
                defaultValue={job.booleanSearch}
                jobId={jobId}
                titleInputId="title"
                descriptionInputId="description"
                skillsInputId="requiredSkills"
                preferredSkillsInputId="preferredSkills"
                certificationsInputId="certifications"
              />
              {job.booleanSearchUpdatedAt && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Last updated {formatDistanceToNow(job.booleanSearchUpdatedAt, { addSuffix: true })}
                </p>
              )}
              <div>
                <Label htmlFor="referralLink">Apply Link</Label>
                <Input
                  id="referralLink"
                  name="referralLink"
                  type="url"
                  placeholder={applyUrl}
                  defaultValue={job.referralLink ?? ""}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave blank to use the default apply link: {applyUrl}
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-border/80 p-4">
                <div>
                  <div className="text-sm font-medium">Auto Email Outreach</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    When enabled, matched candidates above the minimum score receive the selected template
                    automatically after matching or Gmail import.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="autoEmailEnabled"
                    defaultChecked={job.autoEmailEnabled}
                    className="rounded border-border"
                  />
                  Enable automatic outreach for this job
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="autoEmailTemplateId">Email Template</Label>
                    <select
                      id="autoEmailTemplateId"
                      name="autoEmailTemplateId"
                      defaultValue={job.autoEmailTemplateId ?? ""}
                      className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                    >
                      <option value="">Select template</option>
                      {emailTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                          {tpl.jobId ? "" : " (org-wide)"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="autoEmailMinScore">Minimum Match Score</Label>
                    <Input
                      id="autoEmailMinScore"
                      name="autoEmailMinScore"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={job.autoEmailMinScore ?? 70}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {resolveJobDisplayDate(job) && (
                <p className="text-xs text-muted-foreground">
                  Posted {formatJobTimestamp(resolveJobDisplayDate(job))}
                </p>
              )}
              <ReferralLinkCopy url={applyUrl} />
              <SaveJobTemplateForm jobId={jobId} />
            </JobDetailForm>
          </CardContent>
        </Card>
      )}

      {tab === "applicants" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Applicants</CardTitle>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <EmptyState
                title="No applicants yet"
                description="Add candidates from the Matching tab or upload resumes"
              />
            ) : (
              <div className="space-y-2">
                {applications.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Link href={`/candidates/${a.candidateId}`} className="text-sm font-medium hover:text-brand-700">
                        {a.candidate.firstName} {a.candidate.lastName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {candidateLocation(a.candidate) || "Location TBD"} ·{" "}
                        {formatDistanceToNow(a.updatedAt, { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{a.candidate.email}</span>
                      <StageBadge stage={a.stage} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
