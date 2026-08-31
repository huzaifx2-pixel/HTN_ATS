"use client";

type UnsubscribedEntry = {
  id: string;
  email: string;
  createdAt: string;
  candidate?: { id: string; name: string } | null;
};

export function UnsubscribedListPanel({ entries }: { entries: UnsubscribedEntry[] }) {
  return (
    <div className="max-w-3xl rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Unsubscribed contacts</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        These emails are blocked from all marketing campaigns and removed from imported audience lists.
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No unsubscribed contacts yet.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                {entry.candidate ? (
                  <>
                    <p className="font-medium">{entry.candidate.name}</p>
                    <p className="text-xs text-muted-foreground">{entry.email}</p>
                  </>
                ) : (
                  <p className="font-medium">{entry.email}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Unsubscribed {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                Unsubscribed
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
