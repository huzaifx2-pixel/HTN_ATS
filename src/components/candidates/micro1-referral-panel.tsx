import Link from "next/link";
import { STAGE_LABELS, FUNNEL_STAGES } from "@/lib/referrals/status-map";
import type { Micro1Referral, Micro1ReferralStatusEvent, Micro1ReferralStage } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Referral = Micro1Referral & {
  statusEvents: Micro1ReferralStatusEvent[];
  linkedBy?: { id: string; name: string } | null;
  candidate?: { id: string; firstName: string; lastName: string; deletedAt: Date | null } | null;
};

function money(value: unknown) {
  if (value == null) return "—";
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function Micro1ReferralPanel({ referral }: { referral: Referral | null }) {
  if (!referral) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        This candidate has no micro1 referral record. Import a micro1 CSV or link an unmatched referral.
      </div>
    );
  }

  const linkedName = referral.candidate
    ? `${referral.candidate.firstName} ${referral.candidate.lastName}`
    : referral.csvName;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">micro1 Referral</h2>
        <p className="text-sm text-muted-foreground">Attribution layer — the resume remains the primary workspace.</p>
      </div>

      {referral.matchingStatus === "MATCHED" ? (
        <p className="text-sm">
          Linked to {linkedName} · Headsbase ID{" "}
          <span className="font-mono">{referral.candidateId}</span>
          {referral.candidate?.deletedAt ? (
            <Badge variant="secondary" className="ml-2">
              Archived candidate
            </Badge>
          ) : null}
        </p>
      ) : (
        <Badge variant="destructive">{referral.matchingStatus.replace(/_/g, " ")}</Badge>
      )}

      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Project Type</dt>
          <dd>{referral.projectType ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Date Referred</dt>
          <dd>
            {referral.dateReferred
              ? referral.dateReferred.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Raw micro1 Status</dt>
          <dd className="font-mono text-xs">{referral.csvStatus}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ATS Referral Stage</dt>
          <dd>
            <Badge>{STAGE_LABELS[referral.stage]}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total Tasks Completed</dt>
          <dd>{referral.tasksCompleted ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total Hours Worked</dt>
          <dd>{referral.hoursWorked != null ? Number(referral.hoursWorked) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payout Amount</dt>
          <dd>{money(referral.payoutAmount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Transaction ID</dt>
          <dd>{referral.transactionId || "—"}</dd>
        </div>
      </dl>

      {referral.stage === "DUPLICATE" ? (
        <p className="text-sm text-muted-foreground">
          Duplicate: this person already had a micro1 account (`existing-micro1-user`). They are not counted in Total
          Referrals.
        </p>
      ) : (
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {FUNNEL_STAGES.map((stage, index) => {
            const reached = FUNNEL_STAGES.indexOf(referral.stage) >= index;
            return (
              <li key={stage} className="flex items-center gap-2">
                {index > 0 ? <span className="text-muted-foreground">→</span> : null}
                <span className={cn(reached ? "font-semibold text-emerald-700" : "text-muted-foreground")}>
                  {reached ? "✓" : "○"} {STAGE_LABELS[stage as Micro1ReferralStage]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Status history</h3>
        <ul className="space-y-2 text-sm">
          {referral.statusEvents.map((event) => (
            <li key={event.id}>
              {event.createdAt.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {" — "}
              <span className="font-mono text-xs">{event.csvStatus}</span>
              {" → "}
              {STAGE_LABELS[event.appliedStage]}
              <span className="text-muted-foreground"> · Source: micro1 CSV import</span>
            </li>
          ))}
        </ul>
      </div>

      {referral.linkedBy && referral.linkedAt ? (
        <p className="text-xs text-muted-foreground">
          Linked by {referral.linkedBy.name} on {referral.linkedAt.toLocaleString()}
        </p>
      ) : null}

      <Link href="/referrals" className="text-sm text-[#1e4e8c] hover:underline">
        Open micro1 Referrals
      </Link>
    </div>
  );
}
