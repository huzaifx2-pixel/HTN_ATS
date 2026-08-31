import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GoogleCseIntegrationPanel({
  configured,
  hasEngineId,
  hasApiKey,
}: {
  configured: boolean;
  hasEngineId: boolean;
  hasApiKey: boolean;
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-sm">LinkedIn Matches — Google X-Ray</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div
          className={`rounded-lg border px-4 py-2 ${
            configured
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-amber-800 bg-amber-50 border-amber-200"
          }`}
        >
          <strong>{configured ? "Configured" : "Almost ready"}</strong>
          <span className="text-muted-foreground">
            {" "}
            · Engine ID {hasEngineId ? "set" : "missing"} · API key {hasApiKey ? "set" : "missing"}
          </span>
        </div>
        <p className="text-muted-foreground">
          The Programmable Search snippet provides the engine ID (<code>cx</code>). Server-side search also needs a
          Google Cloud <strong>API key</strong> with the Custom Search API enabled — not the Gmail OAuth client ID.
        </p>
        {!configured && (
          <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
            <li>Open Google Cloud Console → APIs &amp; Services → enable <strong>Custom Search API</strong>.</li>
            <li>Credentials → Create credentials → API key.</li>
            <li>Put that key in <code>GOOGLE_CSE_API_KEY</code> in <code>.env</code>, then restart the app.</li>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
