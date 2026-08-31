import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import {
  countCandidates,
  formatCandidateSource,
  listCandidates,
} from "@/lib/services/candidate-service";
import { CandidateTable } from "@/components/candidates/candidate-table";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import { CandidatesPageShell } from "@/components/candidates/executive-candidate-ui";
import { withPagePerf } from "@/lib/perf";
import { RegisterCandidateNav } from "@/components/candidates/register-candidate-nav";

const PAGE_SIZE = 50;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; search?: string; source?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { cursor, search, source } = await searchParams;

  const filtered = Boolean(search || source);
  const [{ items: candidates, nextCursor }, total] = await withPagePerf("candidates", () =>
    Promise.all([
      listCandidates(member.organizationId, {
        limit: PAGE_SIZE,
        cursor,
        search,
        source: source as never,
      }),
      filtered ? Promise.resolve(null) : countCandidates(member.organizationId),
    ]),
  );

  const totalLabel = total
    ? `${total.count.toLocaleString()}${total.capped ? "+" : ""} candidates in your database`
    : "Filtered candidate results";

  const listParams = new URLSearchParams();
  if (search) listParams.set("search", search);
  if (source) listParams.set("source", source);
  if (cursor) listParams.set("cursor", cursor);
  const listQuery = listParams.toString();

  return (
    <CandidatesPageShell totalLabel={totalLabel}>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No candidates yet. Sync Gmail, upload resumes, or add someone manually.
        </p>
      ) : (
        <>
          <RegisterCandidateNav
            ids={candidates.map((candidate) => candidate.id)}
            returnTo={listQuery ? `/candidates?${listQuery}` : "/candidates"}
            append={Boolean(cursor)}
          />
          <CandidateTable
            candidates={candidates.map((candidate) => ({
              id: candidate.id,
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              currentRole: candidate.currentRole,
              email: candidate.email,
              source: candidate.source,
              sourceLabel: formatCandidateSource(candidate.source),
              createdAt: candidate.createdAt.toISOString(),
            }))}
          />
          <div className="border-t border-border px-4 py-3">
            <CursorPagination
              nextCursor={nextCursor}
              basePath="/candidates"
              searchParams={{ search, source, cursor }}
              pageSize={PAGE_SIZE}
              total={total?.count}
              totalCapped={total?.capped}
              shown={candidates.length}
            />
          </div>
        </>
      )}
    </CandidatesPageShell>
  );
}
