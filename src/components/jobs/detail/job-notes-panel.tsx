import { formatDistanceToNow } from "date-fns";
import { createJobNoteAction, deleteJobNoteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/dashboard-widgets";

export function JobNotesPanel({
  jobId,
  notes,
}: {
  jobId: string;
  notes: Array<{
    id: string;
    body: string;
    createdAt: Date;
    author?: { name: string | null } | null;
  }>;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Note</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createJobNoteAction.bind(null, jobId)} className="space-y-3">
            <div>
              <Label htmlFor="body">Note</Label>
              <textarea
                id="body"
                name="body"
                required
                rows={4}
                className="mt-1 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                placeholder="Internal note about this job…"
              />
            </div>
            <Button type="submit" size="sm">
              Save Note
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.length === 0 ? (
            <EmptyState title="No notes yet" description="Add internal notes for your team" />
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {note.author?.name || "Unknown"} · {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                  </div>
                  <form action={deleteJobNoteAction.bind(null, jobId, note.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      Delete
                    </Button>
                  </form>
                </div>
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
