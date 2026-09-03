"use client";

import { useState } from "react";
import type { RecruiterMatchAnalysis, SectionScoreDetail } from "@/lib/matching/recruiter-engine/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function sectionCard(title: string, section: SectionScoreDetail | undefined) {
  if (!section || section.maxScore <= 0) return null;
  return (
    <div className="rounded-md border p-2">
      <div className="font-medium">{title}</div>
      <div>
        {section.score}/{section.maxScore} · {section.confidence}
      </div>
      <div className="text-muted-foreground mt-1">{section.reasoning}</div>
    </div>
  );
}

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
  const [storedScore, setStoredScore] = useState<number | null>(null);
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
      setStoredScore(typeof data.storedScore === "number" ? data.storedScore : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  }

  const booleanSection = analysis?.requirementBreakdown?.booleanSearch;
  const locationSection = analysis?.sectionScores?.location ?? analysis?.requirementBreakdown?.location;
  const scoreDiffers =
    storedScore != null && analysis != null && Math.abs(storedScore - analysis.overallScore) >= 1;

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
              Scored on Boolean search and location only.
              {" · "}
              Recommendation: <span className="font-medium text-foreground">{analysis.recommendation}</span>
              {" · "}
              Confidence: {analysis.confidence}
              {analysis.qualificationStatus && (
                <>
                  {" · "}
                  Status: <span className="font-medium text-foreground">{analysis.qualificationStatus}</span>
                </>
              )}
            </p>
            {scoreDiffers ? (
              <p className="text-xs text-amber-700 mt-1">
                List score {Math.round(storedScore)} is from a previous rematch. Use Rematch to refresh the list.
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-sm leading-relaxed">{analysis.summary}</p>

            {analysis.booleanSearch && (
              <div className="rounded-md border border-brand-200 bg-brand-50 p-2">
                <div className="font-medium">Boolean search</div>
                <div className="text-muted-foreground mt-1">{analysis.booleanSearch.query}</div>
                <div className="mt-1">
                  {analysis.booleanSearch.passes ? "Matched" : "Did not match"}
                  {analysis.booleanSearch.matchedTerms.length > 0 && (
                    <> · Matched terms: {analysis.booleanSearch.matchedTerms.join(", ")}</>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {sectionCard("Boolean search", booleanSection)}
              {sectionCard("Location", locationSection)}
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

            {analysis.risks.length > 0 && analysis.risks[0] !== "No significant risks identified." && (
              <div>
                <div className="font-medium mb-1">Risks</div>
                <ul className="list-disc pl-4 space-y-1">
                  {analysis.risks.map((item) => (
                    <li key={item}>{item}</li>
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
