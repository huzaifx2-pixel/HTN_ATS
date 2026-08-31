"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createKnowledgeDocumentAction, deleteKnowledgeDocumentAction } from "@/app/actions";

export function KnowledgeDocsPanel({
  documents,
}: {
  documents: Array<{ id: string; title: string; updatedAt: Date }>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Playbooks & FAQs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Indexed into the same vector store as resumes and jobs. Org-scoped only.
        </p>
        <form
          className="space-y-2"
          action={async (formData) => {
            setSaving(true);
            try {
              await createKnowledgeDocumentAction(formData);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Input name="title" placeholder="Title" required />
          <Textarea name="body" placeholder="Playbook text" required />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Add playbook"}
          </Button>
        </form>
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No playbooks yet.</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{doc.title}</span>
                <form
                  action={async () => {
                    await deleteKnowledgeDocumentAction(doc.id);
                  }}
                >
                  <Button type="submit" size="sm" variant="outline">
                    Delete
                  </Button>
                </form>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
