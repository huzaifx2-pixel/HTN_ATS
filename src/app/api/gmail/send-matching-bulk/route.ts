import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { sendMatchingHubEmails } from "@/lib/services/email-service";
import { uniqueJobIds } from "@/lib/services/match-email-outreach-service";
import { apiErrorResponse } from "@/lib/api-error";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission("send_email");
    const body = await request.json();
    const kind = body.kind === "followup" ? "followup" : "outreach";
    const jobId = typeof body.jobId === "string" && body.jobId ? body.jobId : undefined;
    const jobIds = uniqueJobIds({
      jobId,
      jobIds: Array.isArray(body.jobIds)
        ? body.jobIds.filter((id: unknown): id is string => typeof id === "string")
        : typeof body.jobIds === "string"
          ? body.jobIds.split(",")
          : [],
    });
    if (jobIds.length === 0) {
      return NextResponse.json({ error: "Select at least one job" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        };

        try {
          const result = await sendMatchingHubEmails({
            kind,
            jobIds,
            templateId: body.templateId,
            customLink: body.customLink,
            subject: body.subject,
            body: body.body,
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            onProgress: async (event) => {
              send({ type: "progress", ...event });
            },
          });
          send({ type: "done", ...result });
        } catch (error) {
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Failed to send emails",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
