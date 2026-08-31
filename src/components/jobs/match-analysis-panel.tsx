"use client";

import { useState } from "react";
import type { RecruiterMatchAnalysis } from "@/lib/matching/recruiter-engine/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MatchAnalysisPanel({
  jobId,
  candidateId,
  candidateName,
}: {
  jobId: string;
  candidateId: string;
  candidateName: string;
}) {
  const [analysis, setAnalysis] = useState<RecruiterMatchAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/matches/${candidateId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load analysis");
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <Button type="button" size="sm" variant="outline" onClick={loadAnalysis} disabled={loading}>
        {loading ? "Loading..." : "View recruiter analysis"}
      </Button>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      {analysis && (
        <Card className="mt-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {candidateName} — {analysis.matchCategory} ({analysis.overallScore}/100)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Recommendation: <span className="font-medium text-foreground">{analysis.recommendation}</span>
              {" · "}
              Confidence: {analysis.confidence}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-sm leading-relaxed">{analysis.summary}</p>

            {analysis.booleanSearch && (
              <div className="rounded-md border border-brand-200 bg-brand-50 p-2">
                <div className="font-medium">Boolean search</div>
                <div className="text-muted-foreground mt-1">{analysis.booleanSearch.query}</div>
                <div className="mt-1">
                  {analysis.booleanSearch.passes ? "Passed" : "Failed"}
                  {analysis.booleanSearch.matchedTerms.length > 0 && (
                    <> · Matched: {analysis.booleanSearch.matchedTerms.join(", ")}</>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(analysis.sectionScores).map(([key, section]) => (
                <div key={key} className="rounded-md border p-2">
                  <div className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}</div>
                  <div>
                    {section.score}/{section.maxScore} · {section.confidence}
                  </div>
                  <div className="text-muted-foreground mt-1">{section.reasoning}</div>
                </div>
              ))}
            </div>

            {analysis.strengths.length > 0 && (
              <div>
                <div className="font-medium mb-1">Strengths</div>
                <ul className="list-disc pl-4 space-y-1">
                  {analysis.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.risks.length > 0 && (
              <div>
                <div className="font-medium mb-1">Risks</div>
                <ul className="list-disc pl-4 space-y-1">
                  {analysis.risks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.criticalMissingRequirements.length > 0 && (
              <div>
                <div className="font-medium mb-1">Critical Missing Requirements</div>
                <ul className="list-disc pl-4 space-y-1">
                  {analysis.criticalMissingRequirements.map((item) => (
                    <li key={item.requirement}>
                      {item.requirement} ({item.severity}) — {item.reasoning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
