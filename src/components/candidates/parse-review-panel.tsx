"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReviewField = {
  entity: string;
  id: string;
  label: string;
  value: string;
  confidence?: number;
  reviewStatus: string;
};

export function ParseReviewPanel({ candidateId }: { candidateId: string }) {
  const [fields, setFields] = useState<ReviewField[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/candidates/${candidateId}/parse-review`);
    const json = (await res.json()) as { fields?: ReviewField[] };
    setFields(json.fields ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [candidateId]);

  async function submit(field: ReviewField, reviewStatus: "approved" | "corrected") {
    setSaving(field.id);
    await fetch(`/api/candidates/${candidateId}/parse-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: field.entity,
        id: field.id,
        reviewStatus,
        value: edits[field.id] ?? field.value,
      }),
    });
    setSaving(null);
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Parser review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading review fields…</p>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fields need review.</p>
        ) : (
          fields.map((field) => (
            <div key={`${field.entity}:${field.id}`} className="rounded-lg border p-3 space-y-2">
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>{field.label}</span>
                <span>
                  {field.reviewStatus}
                  {field.confidence != null ? ` · ${Math.round(field.confidence * 100)}%` : ""}
                </span>
              </div>
              <Input
                className="h-8 text-sm"
                defaultValue={field.value}
                onChange={(event) => setEdits((current) => ({ ...current, [field.id]: event.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={saving === field.id} onClick={() => void submit(field, "approved")}>
                  Approve
                </Button>
                <Button size="sm" disabled={saving === field.id} onClick={() => void submit(field, "corrected")}>
                  Save correction
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
