import { notFound } from "next/navigation";
import { getPublicJob } from "@/lib/services/job-service";
import { PublicApplyForm } from "@/components/apply/public-apply-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJobLocation, formatJobSalary, getJobSalaryFields } from "@/lib/format-job";

export default async function PublicApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getPublicJob(jobId);
  if (!job) notFound();

  const requirements = (job.requirements as { skills?: string[]; experienceYears?: number } | null) ?? {};
  const skills = requirements.skills ?? [];
  const jobLocation = formatJobLocation(job);
  const jobSalary = formatJobSalary(getJobSalaryFields(job));

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <p className="text-xs text-muted-foreground">{job.organization.name}</p>
            <CardTitle>{job.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {job.jobCode} · {job.client.name}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Location:</span> {jobLocation}
              {" · "}
              <span className="text-muted-foreground">Salary:</span> {jobSalary}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {job.description && (
              <div>
                <h2 className="font-medium mb-1">About the role</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
            {skills.length > 0 && (
              <div>
                <h2 className="font-medium mb-2">Skills</h2>
                <div className="flex flex-wrap gap-1">
                  {skills.map((skill) => (
                    <span key={skill} className="rounded bg-muted px-2 py-0.5 text-xs">{skill}</span>
                  ))}
                </div>
              </div>
            )}
            {requirements.experienceYears != null && (
              <p><span className="font-medium">Experience:</span> {requirements.experienceYears}+ years</p>
            )}
            <PublicApplyForm jobId={job.id} jobCode={job.jobCode} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
