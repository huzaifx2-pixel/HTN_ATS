import { unsubscribeAction } from "@/app/marketing-actions";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; org?: string; email?: string }>;
}) {
  const { token, org, email } = await searchParams;

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Invalid unsubscribe link</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link is missing required information.</p>
        </div>
      </div>
    );
  }

  let result: { email: string; removedFromAudiences: number } | null = null;

  if (email) {
    result = await unsubscribeAction(email, org);
  } else if (token) {
    const { prisma } = await import("@/lib/db");
    const recipient = await prisma.marketingCampaignRecipient.findUnique({
      where: { trackingId: token },
      select: { email: true },
    });
    if (recipient) {
      result = await unsubscribeAction(recipient.email, org, token);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        {result ? (
          <>
            <h1 className="text-lg font-semibold">You&apos;ve been unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>{result.email}</strong> has been removed from marketing lists and will not receive future campaign emails from this organization.
            </p>
            {result.removedFromAudiences > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Removed from {result.removedFromAudiences} imported audience list{result.removedFromAudiences === 1 ? "" : "s"}.
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Transactional recruiting messages sent directly by a recruiter may still arrive separately.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Unsubscribe link not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We could not verify this unsubscribe request. The link may have expired or already been used.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
