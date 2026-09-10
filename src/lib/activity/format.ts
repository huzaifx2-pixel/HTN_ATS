const JOB_ACTION_LABELS: Record<string, string> = {
  "job.created": "Created job",
  "job.updated": "Updated job",
  "job.closed": "Closed job",
  "job.published": "Published job",
  "job.website_imported": "Imported from website",
  "job.website_removed": "Removed from website",
  "job.csv_imported": "Imported from CSV sync",
  "job.csv_updated": "Updated from CSV sync",
  "job.csv_removed": "Closed — missing from CSV sync",
  "job.csv_reopened": "Reopened from CSV sync",
  "job.auto_email_sent": "Sent auto-emails",
};

const CANDIDATE_ACTION_LABELS: Record<string, string> = {
  "candidate.created": "Added candidate",
  "candidate.updated": "Updated candidate",
  "candidate.engaged": "Marked engaged",
  "resume.uploaded": "Uploaded resume",
  "resume.version_added": "Added resume version",
  "stage.changed": "Changed pipeline stage",
  "email.sent": "Sent email",
  "email.auto_sent": "Sent auto-email",
  "micro1.applying": "Referred to micro1",
  "micro1.ai_interview": "AI Interview completed",
  "micro1.criteria_met": "Criteria Met",
  "micro1.certified": "Certified",
  "micro1.matched": "Matched to project",
  "micro1.started": "Started",
  "micro1.successful": "Successful",
};

const MARKETING_ACTION_LABELS: Record<string, string> = {
  "marketing.campaign_sent": "Campaign sent",
  "marketing.email_opened": "Email opened",
  "marketing.link_clicked": "Link clicked",
  "marketing.unsubscribed": "Unsubscribed",
};

function titleCase(value: string) {
  return value.replace(/\./g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function describeJobUpdate(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "Updated job";
  const data = metadata as Record<string, unknown>;
  if (data.status === "CLOSED") return "Closed job";
  if (data.status === "OPEN") return "Reopened job";
  if (data.salaryMin !== undefined || data.salaryMax !== undefined) return "Updated salary";
  if (data.title !== undefined) return "Updated job title";
  if (data.booleanSearch !== undefined) return "Updated boolean search";
  if (data.autoEmailEnabled !== undefined) return "Updated auto-email settings";
  return "Updated job";
}

export function formatActivityAction(action: string, metadata?: unknown): string {
  if (action.startsWith("marketing.")) {
    return MARKETING_ACTION_LABELS[action] ?? titleCase(action);
  }
  if (action.startsWith("job.")) {
    if (action === "job.updated") return describeJobUpdate(metadata);
    return JOB_ACTION_LABELS[action] ?? titleCase(action);
  }
  if (action.startsWith("candidate.") || action.startsWith("resume.") || action.startsWith("email.") || action.startsWith("stage.") || action.startsWith("micro1.")) {
    return CANDIDATE_ACTION_LABELS[action] ?? titleCase(action);
  }
  return titleCase(action);
}

export function isMarketingActivityAction(action: string) {
  return action.startsWith("marketing.");
}

export function isCandidateActivityAction(action: string) {
  return (
    action.startsWith("candidate.") ||
    action.startsWith("resume.") ||
    action.startsWith("email.") ||
    action.startsWith("stage.") ||
    action.startsWith("micro1.")
  );
}
