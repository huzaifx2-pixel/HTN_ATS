import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { AskAtsPanel } from "@/components/rag/ask-ats-panel";
import { KnowledgeDocsPanel } from "@/components/rag/knowledge-docs-panel";
import { RagBackfillButton } from "@/components/rag/rag-backfill-button";
import { getRagStatus } from "@/lib/rag/config";
import { countIndexedChunks } from "@/lib/rag/vector-store";
import { listKnowledgeDocuments } from "@/lib/services/knowledge-document-service";

export default async function AskAtsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const status = getRagStatus();
  const [documents, chunkCount] = await Promise.all([
    listKnowledgeDocuments(member.organizationId),
    countIndexedChunks(member.organizationId).catch(() => 0),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Ask ATS"
        description={`Natural-language search over indexed ATS data · ${chunkCount} chunks · PII mode ${status.piiMode}`}
      />
      <AskAtsPanel ready={status.ready} />
      <RagBackfillButton />
      <KnowledgeDocsPanel documents={documents} />
    </div>
  );
}
