import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchScoreBadge } from "@/components/ui/badge";
import Link from "next/link";
import type { StructuredParseResult } from "@/lib/parsers/pipeline/types";

type CandidateWithParse = {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string | null;
  summary?: string | null;
  currentCompany?: string | null;
  currentRole?: string | null;
  experienceYears?: number | null;
  workAuthorization?: string | null;
  availability?: string | null;
  location?: string | null;
  country?: string | null;
  metadata?: unknown;
  parsedResume?: {
    structured?: unknown;
    parseMetadata?: unknown;
    summary?: string | null;
    experience?: unknown;
    education?: unknown;
    certifications?: unknown;
    projects?: unknown;
  } | null;
  candidateSkills?: Array<{
    skill: { name: string };
    yearsExperience?: number | null;
    metadata?: unknown;
  }>;
  currentEmployer?: { name: string } | null;
  experiences?: Array<{
    company: string;
    title: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    isCurrent: boolean;
    responsibilities?: unknown;
  }>;
  educations?: Array<{
    institution: string;
    degree?: string | null;
    field?: string | null;
    graduationDate?: string | null;
  }>;
  candidateCerts?: Array<{ name: string; issuer?: string | null }>;
  matches?: Array<{
    id: string;
    jobId: string;
    score: number;
    missingSkills?: unknown;
    job: { jobCode: string; title: string };
  }>;
  activities?: Array<{ id: string; action: string; createdAt: Date }>;
};

function getStructured(candidate: CandidateWithParse): StructuredParseResult | null {
  const s = candidate.parsedResume?.structured;
  if (s && typeof s === "object") return s as StructuredParseResult;
  return null;
}

function getParseMeta(candidate: CandidateWithParse) {
  const meta = candidate.parsedResume?.parseMetadata ?? candidate.metadata;
  if (meta && typeof meta === "object") return meta as Record<string, unknown>;
  const profile = (candidate.metadata as { parseProfile?: Record<string, unknown> } | null)?.parseProfile;
  return profile ?? null;
}

export function CandidateProfileSections({ candidate }: { candidate: CandidateWithParse }) {
  const structured = getStructured(candidate);
  const meta = getParseMeta(candidate);
  const quality = (meta?.quality ?? structured?.quality) as
    | { overall?: number; contactCompleteness?: number; sectionCompleteness?: number; missingSections?: string[] }
    | undefined;
  const metrics = (meta?.experience_metrics ?? structured?.metrics) as
    | { totalYears?: number; companyCount?: number; jobHopperRisk?: string; averageTenureMonths?: number }
    | undefined;
  const insights = (meta?.insights ?? structured?.insights) as
    | { currentSeniority?: string; topSkills?: string[]; resumeCompleteness?: number; promotionTrend?: string }
    | undefined;

  const skillsByCategory = new Map<string, Array<{ name: string; confidence?: number }>>();
  if (structured?.skills?.length) {
    for (const s of structured.skills) {
      const cat = s.category || "Technical";
      if (!skillsByCategory.has(cat)) skillsByCategory.set(cat, []);
      skillsByCategory.get(cat)!.push({ name: s.skill.value, confidence: s.skill.confidence });
    }
  } else if (candidate.candidateSkills?.length) {
    for (const cs of candidate.candidateSkills) {
      const cat =
        ((cs.metadata as { category?: string } | null)?.category) ?? "Technical";
      if (!skillsByCategory.has(cat)) skillsByCategory.set(cat, []);
      skillsByCategory.get(cat)!.push({ name: cs.skill.name });
    }
  }

  const structuredExperience = structured?.experience?.length ? structured.experience : null;
  const experience =
    structuredExperience ??
    (Array.isArray(candidate.parsedResume?.experience) && (candidate.parsedResume!.experience as unknown[]).length > 0
      ? (candidate.parsedResume!.experience as Array<{
          company: string;
          role: string;
          startDate?: string;
          endDate?: string;
          isCurrent?: boolean;
          responsibilities?: string[];
        }>).map((e) => ({
          company: { value: e.company },
          jobTitle: { value: e.role },
          startDate: e.startDate ? { value: e.startDate } : undefined,
          endDate: e.endDate ? { value: e.endDate } : undefined,
          isCurrent: e.isCurrent,
          responsibilities: e.responsibilities,
        }))
      : candidate.experiences?.map((job) => ({
          company: { value: job.company },
          jobTitle: { value: job.title },
          startDate: job.startDate ? { value: String(job.startDate).slice(0, 10) } : undefined,
          endDate: job.endDate ? { value: String(job.endDate).slice(0, 10) } : undefined,
          isCurrent: job.isCurrent,
          responsibilities: Array.isArray(job.responsibilities) ? (job.responsibilities as string[]) : undefined,
        })) ?? []);

  const education =
    (structured?.education?.length ? structured.education : null) ??
    (Array.isArray(candidate.parsedResume?.education) && (candidate.parsedResume!.education as unknown[]).length > 0
      ? candidate.parsedResume!.education
      : candidate.educations?.map((row) => ({
          institution: { value: row.institution },
          degree: row.degree ? { value: row.degree } : undefined,
          graduationDate: row.graduationDate ?? undefined,
        })) ??
        []);
  const certifications =
    (structured?.certifications?.length ? structured.certifications : null) ??
    (Array.isArray(candidate.parsedResume?.certifications) && (candidate.parsedResume!.certifications as unknown[]).length > 0
      ? candidate.parsedResume!.certifications
      : candidate.candidateCerts?.map((row) => ({ name: { value: row.name } })) ??
        []);
  const projects = structured?.projects ?? candidate.parsedResume?.projects ?? [];
  const awards = structured?.awards ?? [];
  const publications = structured?.publications ?? [];

  return (
    <div className="space-y-4 mb-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Candidate Overview</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div><span className="text-muted-foreground">Headline:</span> {candidate.headline ?? "—"}</div>
          <div><span className="text-muted-foreground">Employer:</span> {candidate.currentEmployer?.name ?? candidate.currentCompany ?? "—"}</div>
          <div><span className="text-muted-foreground">Seniority:</span> {insights?.currentSeniority ?? "—"}</div>
          <div><span className="text-muted-foreground">Experience:</span> {metrics?.totalYears ?? candidate.experienceYears ?? "—"} yrs</div>
          <div><span className="text-muted-foreground">Career trend:</span> {insights?.promotionTrend ?? "—"}</div>
          <div><span className="text-muted-foreground">Parser:</span> {structured?.parserVersion ?? "—"}</div>
          <div><span className="text-muted-foreground">Location:</span> {candidate.location ?? "—"}</div>
          <div><span className="text-muted-foreground">Work Auth:</span> {candidate.workAuthorization ?? "—"}</div>
          <div><span className="text-muted-foreground">Availability:</span> {candidate.availability ?? "—"}</div>
        </CardContent>
      </Card>

      {(quality || metrics) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Resume Insights</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><span className="text-muted-foreground">Quality:</span> {quality?.overall ?? "—"}%</div>
            <div><span className="text-muted-foreground">Contact:</span> {quality?.contactCompleteness ?? "—"}%</div>
            <div><span className="text-muted-foreground">Sections:</span> {quality?.sectionCompleteness ?? "—"}%</div>
            <div><span className="text-muted-foreground">Companies:</span> {metrics?.companyCount ?? "—"}</div>
            <div><span className="text-muted-foreground">Avg Tenure:</span> {metrics?.averageTenureMonths ? `${metrics.averageTenureMonths} mo` : "—"}</div>
            <div><span className="text-muted-foreground">Job Hopper Risk:</span> {metrics?.jobHopperRisk ?? "—"}</div>
            {quality?.missingSections && quality.missingSections.length > 0 && (
              <div className="sm:col-span-2 lg:col-span-4 text-xs text-amber-700">
                Missing sections: {quality.missingSections.join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {skillsByCategory.size > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Skills (Categorized)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[...skillsByCategory.entries()].map(([category, skills]) => (
              <div key={category}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{category}</div>
                <div className="flex flex-wrap gap-1">
                  {skills.map((s) => (
                    <span key={`${category}-${s.name}`} className="rounded bg-muted px-2 py-0.5 text-xs" title={s.confidence ? `${Math.round(s.confidence * 100)}% confidence` : undefined}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Array.isArray(experience) && experience.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Employment Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {experience.map((job, i) => (
              <div key={i} className="border-l-2 border-brand-700/30 pl-3">
                <div className="font-medium text-sm">{job.jobTitle.value}</div>
                <div className="text-sm text-muted-foreground">{job.company.value}</div>
                <div className="text-xs text-muted-foreground">
                  {[job.startDate?.value, job.isCurrent ? "Present" : job.endDate?.value].filter(Boolean).join(" – ")}
                </div>
                {job.responsibilities && job.responsibilities.length > 0 && (
                  <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                    {job.responsibilities.slice(0, 3).map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Array.isArray(education) && education.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Education</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(education as Array<{ institution?: { value: string } | string; degree?: { value: string }; graduationDate?: string; year?: string }>).map((e, i) => (
              <div key={i}>
                <div className="font-medium">{typeof e.institution === "object" ? e.institution?.value : e.institution}</div>
                <div className="text-muted-foreground text-xs">{e.degree?.value ?? ""} {e.graduationDate ?? e.year ?? ""}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Array.isArray(certifications) && certifications.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Certifications</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {(certifications as Array<{ name?: { value: string } | string } | string>).map((c, i) => (
              <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs">
                {typeof c === "string" ? c : typeof c.name === "object" ? c.name?.value : c.name}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {Array.isArray(projects) && projects.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Projects</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(projects as Array<{ name?: { value: string }; description?: string; technologies?: string[] }>).map((p, i) => (
              <div key={i}>
                <div className="font-medium">{p.name?.value ?? "Project"}</div>
                {p.description && <div className="text-xs text-muted-foreground">{p.description.slice(0, 160)}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {awards.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Awards</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {awards.map((item, i) => (
              <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs">{item.name.value}</span>
            ))}
          </CardContent>
        </Card>
      )}

      {publications.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Publications</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {publications.map((item, i) => (
              <div key={i}>{item.title.value}{item.year ? ` (${item.year})` : ""}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {candidate.summary && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Professional Summary</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{candidate.summary}</CardContent>
        </Card>
      )}

      {candidate.matches && candidate.matches.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Matching</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {candidate.matches.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/jobs/${m.jobId}`} className="hover:text-brand-700 truncate">
                  {m.job.jobCode} · {m.job.title}
                </Link>
                <MatchScoreBadge score={m.score} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {candidate.activities && candidate.activities.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {candidate.activities.slice(0, 8).map((a) => (
              <div key={a.id}>{a.action} · {new Date(a.createdAt).toLocaleString()}</div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
