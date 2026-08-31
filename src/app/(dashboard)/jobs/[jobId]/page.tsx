import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getJob, getJobActivities } from "@/lib/services/job-service";
import { listClients } from "@/lib/services/client-service";
import { getJobApplications, getJobMatches, promoteEmailedMatchesToApplicants } from "@/lib/services/pipeline-service";
import { getEmailCampaignStats, listEmailTemplates, seedDefaultEmailTemplates } from "@/lib/services/email-service";
import { getGmailConnection } from "@/lib/services/gmail-service";
import { MatchCandidateEmail } from "@/components/jobs/match-candidate-email";
import { MatchBulkEmail } from "@/components/jobs/match-bulk-email";
import { MatchAnalysisPanel } from "@/components/jobs/match-analysis-panel";
import { getJobReferralUrl, formatJobTimestamp } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/shared/dashboard-widgets";
import { StatusBadge, MatchScoreBadge, StageBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PipelineKanban } from "@/components/jobs/pipeline-kanban";
import { formatDistanceToNow } from "date-fns";
import { ReferralLinkCopy } from "@/components/jobs/referral-link-copy";
import { CountrySelect } from "@/components/jobs/country-select";
import { getSalaryPeriodFromMetadata, SALARY_PERIODS } from "@/lib/constants/salary-periods";
import { formatJobLocation, formatJobSalary, getJobSalaryFields, resolveJobDisplayDate } from "@/lib/format-job";
import { BooleanSearchEditor } from "@/components/jobs/boolean-search-editor";
import { updateJobBooleanAction, addCandidateToJobAction } from "@/app/actions";
import { JobDescriptionView } from "@/components/jobs/job-description-view";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import { SaveJobTemplateForm } from "@/components/jobs/save-job-template-form";
import { LinkedInMatchesPanel } from "@/components/jobs/linkedin-matches-panel";
import { MatchingChannelTabs, parseMatchingChannel } from "@/components/jobs/matching-channel-tabs";
import { getJobAnalytics } from "@/lib/services/job-analytics-service";
import { JobAnalyticsPanel } from "@/components/jobs/job-analytics-panel";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ tab?: string; cursor?: string; channel?: string }>;
}) {
  const { jobId } = await params;
  const { tab: rawTab = "overview", cursor, channel: rawChannel } = await searchParams;
  const tab = rawTab === "candidates" ? "applicants" : rawTab === "settings" ? "edit" : rawTab;
  const matchingChannel = parseMatchingChannel(rawChannel);
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const job = await getJob(jobId.trim(), member.organizationId);
  if (!job) notFound();

  const needsApplications = tab === "applicants" || tab === "pipeline";
  const needsInternalMatches = tab === "matching" && matchingChannel === "internal";
  const needsMatches = needsInternalMatches;
  const needsActivities = tab === "activity";
  const needsClients = tab === "edit";
  const needsEmail = tab === "email" || needsInternalMatches;

  const needsAnalytics = tab === "analytics";

  if (needsMatches) {
    await promoteEmailedMatchesToApplicants(jobId, member.organizationId);
  }

  const [applications, matches, activities, emailStats, clients, gmail, jobAnalytics] = await Promise.all([
    needsApplications ? getJobApplications(jobId, member.organizationId) : Promise.resolve([]),
    needsInternalMatches
      ? getJobMatches(jobId, member.organizationId, { cursor })
      : Promise.resolve({ items: [], total: 0, nextCursor: undefined as string | undefined }),
    needsActivities ? getJobActivities(jobId, member.organizationId) : Promise.resolve([]),
    tab === "email" ? getEmailCampaignStats(jobId, member.organizationId) : Promise.resolve(null),
    needsClients ? listClients(member.organizationId) : Promise.resolve([]),
    needsEmail ? getGmailConnection(session.user.id) : Promise.resolve(null),
    needsAnalytics ? getJobAnalytics(jobId, member.organizationId) : Promise.resolve(null),
  ]);

  let emailTemplates: Awaited<ReturnType<typeof listEmailTemplates>> = [];
  if (needsEmail) {
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
  const salaryMin = job.salaryMin != null ? Number(job.salaryMin) : undefined;
  const salaryMax = job.salaryMax != null ? Number(job.salaryMax) : undefined;
  const salaryPeriod = getSalaryPeriodFromMetadata(job.metadata);
  const jobLocation = formatJobLocation(job);
  const jobSalary = formatJobSalary(getJobSalaryFields(job));
  const applyUrl = getJobReferralUrl(job);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "applicants", label: "Applicants" },
    { key: "matching", label: "Matching" },
    { key: "pipeline", label: "Pipeline" },
    { key: "analytics", label: "Analytics" },
    { key: "email", label: "Email Performance" },
    { key: "activity", label: "Activity" },
    { key: "edit", label: "Edit" },
  ];

  return (
    <div>
      <PageHeader
        title={job.title}
        description={`${job.jobCode} · ${job.client.name} · ${jobLocation}`}
        actions={
          <div className="flex items-center gap-2">
            {tab !== "edit" && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/jobs/${jobId}?tab=edit`}>Edit</Link>
              </Button>
            )}
            <StatusBadge status={job.status} />
          </div>
        }
      />

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/jobs/${jobId}?tab=${t.key}`}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-brand-700 text-brand-700 font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <Card className="max-w-3xl">
          <CardHeader><CardTitle className="text-sm">Job Details</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div><span className="text-muted-foreground">Location:</span> {jobLocation}</div>
                <div><span className="text-muted-foreground">Salary:</span> {jobSalary}</div>
              </div>
              <div>
                <div><span className="text-muted-foreground">Openings:</span> {job.openings}</div>
                {experienceYears != null && (
                  <div><span className="text-muted-foreground">Experience:</span> {experienceYears}+ years</div>
                )}
              </div>
              <div>
                <div>
                  <span className="text-muted-foreground">Applicants:</span>{" "}
                  <Link href={`/jobs/${jobId}?tab=applicants`} className="text-brand-700 hover:underline font-medium">
                    {job._count.applications}
                  </Link>
                </div>
              </div>
              <div>
                <div>
                  <span className="text-muted-foreground">Matches:</span>{" "}
                  <Link href={`/jobs/${jobId}?tab=matching`} className="text-brand-700 hover:underline font-medium">
                    {job._count.matches}
                  </Link>
                </div>
                {resolveJobDisplayDate(job) && (
                  <div>
                    <span className="text-muted-foreground">Posted:</span>{" "}
                    {formatJobTimestamp(resolveJobDisplayDate(job))}
                  </div>
                )}
              </div>
            </div>
            <JobDescriptionView
              description={job.description}
              responsibilities={job.responsibilities}
              requirementsText={job.requirementsText}
              preferredQualifications={job.preferredQualifications}
              skills={jobSkills}
            />
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Boolean Search</CardTitle>
              </CardHeader>
              <CardContent>
                <form id="job-boolean-form" action={updateJobBooleanAction.bind(null, jobId)} className="space-y-3">
                  <BooleanSearchEditor
                    defaultValue={job.booleanSearch}
                    jobId={jobId}
                    rows={12}
                  />
                  <Button type="submit" size="sm">
                    Save Boolean
                  </Button>
                </form>
              </CardContent>
            </Card>
            {job.autoEmailEnabled && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
                Auto-email outreach is enabled
                {job.autoEmailMinScore ? ` for matches ≥ ${job.autoEmailMinScore}%` : ""}.
              </div>
            )}
            <ReferralLinkCopy url={applyUrl} />
            <div className="border-t border-border pt-4">
              <SaveJobTemplateForm jobId={jobId} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "email" && emailStats && (
        <div className="space-y-4">
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-sm">Email Performance</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Sent:</span> {emailStats.sent}</div>
              <div><span className="text-muted-foreground">Delivered:</span> {emailStats.delivered}</div>
              <div><span className="text-muted-foreground">Opened:</span> {emailStats.opened}</div>
              <div><span className="text-muted-foreground">Clicked:</span> {emailStats.clicked}</div>
              <div><span className="text-muted-foreground">Replied:</span> {emailStats.replied}</div>
            </CardContent>
          </Card>
          {emailStats.recent && emailStats.recent.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Sent Emails</CardTitle></CardHeader>
              <CardContent className="divide-y">
                {emailStats.recent.map((msg) => (
                  <div key={msg.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{msg.recipientName || msg.recipientEmail}</div>
                      <div className="text-xs text-muted-foreground">{msg.subject}</div>
                      {msg.autoSent && (
                        <span className="text-[10px] text-brand-700">Auto-sent</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right shrink-0">
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
              {job.booleanSearch ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining pool — showing {matches.items.length}
                  {matches.total > matches.items.length ? ` of ${matches.total}` : ""} candidates.
                  Emailed matches move to Applicants.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Add a Boolean Search query in Job Settings to enable resume matching for this job.
                </p>
              )}
            </div>
            {job.booleanSearch && matches.total > 0 && (
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
              gmailConnected={!!gmail}
              userEmail={gmail?.email}
            />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!job.booleanSearch ? (
              <EmptyState
                title="Matching disabled"
                description="Set a Boolean Search query in Job Settings to match candidates against this job."
              />
            ) : (
              <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{jobLocation}</span>
              {" · "}
              <span className="font-medium text-foreground">{jobSalary}</span>
            </p>
            <div className="space-y-3">
              {matches.items.length === 0 ? (
                <EmptyState
                  title="No remaining matches"
                  description="Emailed candidates are on the Applicants tab. Add a Boolean query or wait for matching if the pool is empty."
                />
              ) : (
                matches.items.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/candidates/${m.candidateId}`}
                          className="font-medium text-sm text-brand-700 hover:underline"
                        >
                          {m.candidate.firstName} {m.candidate.lastName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{m.candidate.currentRole}</div>
                        <div className="text-xs text-muted-foreground mt-1">{m.reason}</div>
                        <MatchAnalysisPanel
                          jobId={jobId}
                          candidateId={m.candidateId}
                          candidateName={`${m.candidate.firstName} ${m.candidate.lastName}`}
                        />
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <MatchScoreBadge score={m.score} />
                        <div className="text-[10px] text-muted-foreground">
                          JD {m.descriptionMatch}% · Skills {m.skillsMatch}% · Exp {m.experienceMatch}%
                          {"semanticScore" in m && Number(m.semanticScore) > 0
                            ? ` · Semantic ${Math.round(Number(m.semanticScore))}%`
                            : ""}
                        </div>
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
                              gmailConnected={!!gmail}
                              userEmail={gmail?.email}
                            />
                            <form action={addCandidateToJobAction.bind(null, jobId, m.candidateId)}>
                              <Button type="submit" size="sm" variant="outline">Add to job</Button>
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
              </>
            )}
          </CardContent>
        </Card>
          )}
        </div>
      )}

      {tab === "pipeline" && (
        <PipelineKanban
          jobId={jobId}
          applications={applications.map((a) => ({
            id: a.id,
            stage: a.stage,
            candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`,
            currentRole: a.candidate.currentRole,
          }))}
        />
      )}

      {tab === "analytics" && jobAnalytics && <JobAnalyticsPanel analytics={jobAnalytics} />}

      {tab === "activity" && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {activities.length === 0 ? (
              <EmptyState title="No activity yet" description="Job events will appear here" />
            ) : (
              activities.map((a) => (
                <div key={a.id} className="text-sm border-b pb-2">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-muted-foreground ml-2">
                    {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "edit" && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle className="text-sm">Edit Job</CardTitle></CardHeader>
          <CardContent>
            <form
              key={job.updatedAt.toISOString()}
              action={async (fd) => {
              "use server";
              const { updateJobAction } = await import("@/app/actions");
              await updateJobAction(jobId, fd);
            }} className="space-y-4">
              <div>
                <Label htmlFor="clientId">Client</Label>
                <select
                  id="clientId"
                  name="clientId"
                  required
                  defaultValue={job.clientId}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.prefix})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={job.status}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                >
                  <option value="OPEN">Open</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="CLOSED">Closed</option>
                  <option value="FILLED">Filled</option>
                </select>
              </div>
              <div>
                <Label htmlFor="title">Job Title</Label>
                <Input id="title" name="title" defaultValue={job.title} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="jobCode">Job ID</Label>
                <Input id="jobCode" name="jobCode" defaultValue={job.jobCode} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="description">Job Description</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  defaultValue={job.description ?? ""}
                  className="mt-1 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" name="location" defaultValue={job.location ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <CountrySelect
                    id="country"
                    name="country"
                    defaultValue={job.country ?? ""}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="openings">Openings</Label>
                <Input id="openings" name="openings" type="number" min={1} defaultValue={job.openings} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 items-end gap-4 lg:grid-cols-4">
                <div>
                  <Label htmlFor="salaryMin">Salary (min)</Label>
                  <Input
                    id="salaryMin"
                    name="salaryMin"
                    type="number"
                    min={0}
                    step="1000"
                    defaultValue={salaryMin ?? ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="salaryMax">Salary (max)</Label>
                  <Input
                    id="salaryMax"
                    name="salaryMax"
                    type="number"
                    min={0}
                    step="1000"
                    defaultValue={salaryMax ?? ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <select
                    id="salaryPeriod"
                    name="salaryPeriod"
                    defaultValue={salaryPeriod}
                    aria-label="Salary period"
                    className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                  >
                    {SALARY_PERIODS.map((period) => (
                      <option key={period.value} value={period.value}>
                        {period.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="salaryCurrency">Currency</Label>
                  <Input
                    id="salaryCurrency"
                    name="salaryCurrency"
                    defaultValue={job.salaryCurrency ?? "USD"}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="preferredSkills">Preferred Skills (comma-separated)</Label>
                <Input
                  id="preferredSkills"
                  name="preferredSkills"
                  defaultValue={preferredSkills.join(", ")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="requiredSkills">Required Skills (comma-separated)</Label>
                <Input id="requiredSkills" name="requiredSkills" defaultValue={jobSkills.join(", ")} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="certifications">Certifications (comma-separated)</Label>
                <Input
                  id="certifications"
                  name="certifications"
                  defaultValue={certifications.join(", ")}
                  placeholder="AWS Solutions Architect, PMP"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="experienceYears">Experience (years)</Label>
                <Input
                  id="experienceYears"
                  name="experienceYears"
                  type="number"
                  min={0}
                  defaultValue={experienceYears ?? ""}
                  className="mt-1"
                />
              </div>
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
                <p className="text-xs text-muted-foreground -mt-2">
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
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to use the default apply link: {applyUrl}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium">Auto Email Outreach</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, matched candidates above the minimum score receive the selected template automatically after matching or Gmail import.
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
                          {tpl.name}{tpl.jobId ? "" : " (org-wide)"}
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

              <Button type="submit">Save Changes</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === "applicants" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Applicants</CardTitle></CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <EmptyState title="No applicants yet" description="Add candidates from the Matching tab or upload resumes" />
            ) : (
              <div className="space-y-2">
                {applications.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <Link href={`/candidates/${a.candidateId}`} className="text-sm font-medium hover:text-brand-700">
                      {a.candidate.firstName} {a.candidate.lastName}
                    </Link>
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
