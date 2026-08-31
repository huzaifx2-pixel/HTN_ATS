import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getCandidateProfile } from "@/lib/services/candidate-profile-service";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MatchScoreBadge, StageBadge } from "@/components/ui/badge";
import { parseSkills } from "@/lib/utils";
import {
  PHONE_COUNTRY_CODES,
  resolvePhoneCountryCode,
} from "@/lib/format-phone";
import {
  getCandidateEmails,
  getCandidateLocation,
  getCandidatePhones,
} from "@/lib/candidate-contact-display";
import { sanitizeCandidateEmail } from "@/lib/sanitize-contact";
import { isCandidateEngaged } from "@/lib/services/candidate-service";
import { CandidateEmailCompose } from "@/components/candidates/candidate-email-compose";
import { DeleteCandidateButton } from "@/components/candidates/delete-candidate-button";
import { engageCandidateAction } from "@/app/actions";
import { after } from "next/server";
import { trackRequestDuration, withPagePerf } from "@/lib/perf";
import { CandidateTimeline } from "@/components/candidates/candidate-timeline";
import { DuplicateCandidatesPanel } from "@/components/candidates/duplicate-candidates-panel";
import { ParseReviewPanel } from "@/components/candidates/parse-review-panel";
import { CandidateRecordLayout, normalizeCandidateTab } from "@/components/candidates/candidate-record-layout";
import { CandidateRecordSidebar, type RecordNote } from "@/components/candidates/candidate-record-sidebar";
import { CandidateResumePane } from "@/components/candidates/candidate-resume-pane";
import {
  getCertificationRows,
  getEducationRows,
  getExperienceRows,
  getSkillNames,
} from "@/lib/candidates/profile-view-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).format(value);
}

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = normalizeCandidateTab(rawTab);
  after(trackRequestDuration("candidate-profile"));

  const { candidate, gmail, timeline, duplicates } = await withPagePerf("candidate-profile", async () => {
    const session = await getSession();
    if (!session?.user) redirect("/login");
    const member = await getActiveOrganization(session.user.id);
    if (!member) redirect("/signup");

    const loaded = await getCandidateProfile(id, member.organizationId, { userId: session.user.id });
    if (!loaded) {
      return { candidate: null, gmail: null, timeline: [], duplicates: [] };
    }
    return loaded;
  });
  if (!candidate) notFound();

  const doc =
    candidate.documents.find((item) => item.type === "RESUME" && item.isLatest) ??
    candidate.documents.find((item) => item.type === "RESUME") ??
    candidate.documents[0];
  const previewUrl = doc ? `/api/files/${doc.storageKey}` : undefined;
  const downloadUrl = doc ? `/api/files/${doc.storageKey}?download=1` : undefined;
  const skills = parseSkills(candidate.skills);
  const parsedSkills = getSkillNames(candidate);
  const highlightSkills = parsedSkills.length > 0 ? parsedSkills : skills;

  const appliedJobIds = new Set(candidate.applications.map((a) => a.jobId));
  const matchingJobs = candidate.matches.filter((m) => !appliedJobIds.has(m.jobId));
  const engaged = isCandidateEngaged(candidate);
  const phoneCountryCode = resolvePhoneCountryCode(candidate);
  const contactEmails = getCandidateEmails(candidate);
  const contactPhones = getCandidatePhones(candidate);
  const contactLocation = getCandidateLocation(candidate);
  const primaryEmail = sanitizeCandidateEmail(candidate.email) ?? contactEmails[0]?.value;
  const primaryPhone = contactPhones[0]?.value;
  const fullName = `${candidate.firstName} ${candidate.lastName}`;
  const title = [candidate.currentRole, candidate.currentCompany].filter(Boolean).join(" at ");

  const notes: RecordNote[] = timeline.map((event) => ({
    id: event.id,
    date: shortDate(event.at),
    recruiter: "System",
    jobLabel: event.href?.startsWith("/jobs/") ? event.detail?.slice(0, 24) : undefined,
    jobHref: event.href?.startsWith("/jobs/") ? event.href : undefined,
    note: event.title,
  }));

  const sidebar = (
    <CandidateRecordSidebar
      candidateId={id}
      name={fullName}
      email={primaryEmail}
      phone={primaryPhone}
      location={contactLocation}
      linkedIn={candidate.linkedIn}
      notes={notes}
      skills={highlightSkills}
      experience={getExperienceRows(candidate)}
      education={getEducationRows(candidate)}
      certifications={getCertificationRows(candidate)}
    />
  );

  let main: ReactNode;

  if (tab === "edit") {
    main = (
      <div className="p-4">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Edit Candidate</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (fd) => {
                "use server";
                const { updateCandidateAction } = await import("@/app/actions");
                await updateCandidateAction(id, fd);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" defaultValue={candidate.firstName} required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" defaultValue={candidate.lastName} required className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={primaryEmail ?? ""} className="mt-1" />
              </div>
              <div>
                <Label className="mb-1 block">Phone</Label>
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <select
                    id="phoneCountryCode"
                    name="phoneCountryCode"
                    defaultValue={phoneCountryCode ?? ""}
                    className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">Code</option>
                    {PHONE_COUNTRY_CODES.map(({ code, label }) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                    {phoneCountryCode &&
                      !PHONE_COUNTRY_CODES.some(({ code }) => code === phoneCountryCode) && (
                        <option value={phoneCountryCode}>{phoneCountryCode}</option>
                      )}
                  </select>
                  <Input id="phone" name="phone" type="tel" placeholder="Phone number" defaultValue={candidate.phone ?? ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentRole">Current Role</Label>
                  <Input id="currentRole" name="currentRole" defaultValue={candidate.currentRole ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="currentCompany">Current Company</Label>
                  <Input
                    id="currentCompany"
                    name="currentCompany"
                    defaultValue={candidate.currentCompany ?? ""}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="linkedIn">LinkedIn</Label>
                <Input id="linkedIn" name="linkedIn" defaultValue={candidate.linkedIn ?? ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="githubUrl">GitHub</Label>
                <Input id="githubUrl" name="githubUrl" defaultValue={candidate.githubUrl ?? ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="portfolioUrl">Portfolio</Label>
                <Input id="portfolioUrl" name="portfolioUrl" defaultValue={candidate.portfolioUrl ?? ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input id="skills" name="skills" defaultValue={skills.join(", ")} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="experienceYears">Experience (years)</Label>
                <Input
                  id="experienceYears"
                  name="experienceYears"
                  type="number"
                  defaultValue={candidate.experienceYears ?? ""}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex gap-2">
                  <Button type="submit">Save Changes</Button>
                  <Button asChild type="button" variant="outline">
                    <Link href={`/candidates/${id}?tab=resume`}>Cancel</Link>
                  </Button>
                </div>
                <DeleteCandidateButton candidateId={id} candidateName={fullName} />
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  } else if (tab === "activity") {
    main = (
      <div className="p-4">
        <CandidateTimeline events={timeline} />
      </div>
    );
  } else if (tab === "parse") {
    main = (
      <div className="p-4">
        <ParseReviewPanel candidateId={id} />
      </div>
    );
  } else if (tab === "duplicates") {
    main = (
      <div className="p-4">
        <DuplicateCandidatesPanel candidateId={id} duplicates={duplicates} />
      </div>
    );
  } else if (tab === "email") {
    main = (
      <div className="p-4">
        <CandidateEmailCompose
          candidateId={id}
          candidateEmail={primaryEmail}
          candidateName={fullName}
          gmailConnected={!!gmail}
          userEmail={gmail?.email}
        />
      </div>
    );
  } else if (tab === "matches") {
    main = (
      <div className="space-y-2 p-4">
        {matchingJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open job matches yet.</p>
        ) : (
          matchingJobs.map((match) => (
            <div key={match.id} className="flex items-center justify-between rounded border border-[#d7e0ea] px-3 py-2">
              <Link href={`/jobs/${match.jobId}`} className="text-sm text-[#1e4e8c] hover:underline">
                {match.job.jobCode} · {match.job.title}
              </Link>
              <MatchScoreBadge score={match.score} />
            </div>
          ))
        )}
      </div>
    );
  } else if (tab === "applications") {
    main = (
      <div className="space-y-2 p-4">
        {!engaged && (
          <form action={engageCandidateAction.bind(null, id)}>
            <Button type="submit" size="sm" className="bg-[#1e4e8c] hover:bg-[#163a68]">
              Add to Talent Pool
            </Button>
          </form>
        )}
        {candidate.applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not applied to any jobs yet.</p>
        ) : (
          candidate.applications.map((application) => (
            <div key={application.id} className="flex items-center justify-between rounded border border-[#d7e0ea] px-3 py-2">
              <Link href={`/jobs/${application.jobId}`} className="text-sm text-[#1e4e8c] hover:underline">
                {application.job.jobCode} · {application.job.title}
              </Link>
              <StageBadge stage={application.stage} />
            </div>
          ))
        )}
      </div>
    );
  } else if (tab === "linkedin") {
    main = (
      <div className="p-4">
        {candidate.linkedIn ? (
          <div className="space-y-3">
            <a
              href={candidate.linkedIn}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#1e4e8c] hover:underline"
            >
              Open LinkedIn profile
            </a>
            <p className="text-xs text-muted-foreground">{candidate.linkedIn}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No LinkedIn URL on file. Add it in Edit.</p>
        )}
      </div>
    );
  } else {
    main = (
      <div className="flex h-full min-h-0 flex-col">
        {!engaged && (
          <form action={engageCandidateAction.bind(null, id)} className="border-b border-[#d7e0ea] px-3 py-2">
            <Button type="submit" size="sm" className="bg-[#1e4e8c] hover:bg-[#163a68]">
              Add to Talent Pool
            </Button>
          </form>
        )}
        <CandidateResumePane
          candidateId={id}
          name={fullName}
          title={title || candidate.headline}
          workAuthorization={candidate.workAuthorization}
          location={contactLocation}
          email={primaryEmail}
          phone={primaryPhone}
          source={candidate.source}
          createdAt={candidate.createdAt}
          summary={candidate.summary ?? candidate.parsedResume?.summary}
          skills={highlightSkills}
          previewUrl={previewUrl}
          downloadUrl={downloadUrl}
          fileName={doc?.fileName}
          mimeType={doc?.mimeType}
          documents={candidate.documents.filter((item) => item.type === "RESUME")}
        />
      </div>
    );
  }

  return (
    <CandidateRecordLayout candidateId={id} activeTab={tab} sidebar={sidebar}>
      {main}
    </CandidateRecordLayout>
  );
}
