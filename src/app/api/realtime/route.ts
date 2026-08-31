import { auth } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/auth/session";
import { subscribeOrgEvents } from "@/lib/realtime/hub";
import { touchPresence, clearPresence } from "@/lib/realtime/presence";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const member = await getActiveOrganization(session.user.id);
  if (!member) {
    return new Response("Unauthorized", { status: 401 });
  }

  const organizationId = member.organizationId;
  const userId = session.user.id;
  const userName = session.user.name ?? "User";
  const encoder = new TextEncoder();

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  touchPresence(organizationId, userId, userName);

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", at: Date.now(), organizationId });

      unsubscribe = subscribeOrgEvents(organizationId, send);

      heartbeat = setInterval(() => {
        touchPresence(organizationId, userId, userName);
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        clearPresence(organizationId, userId);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
      clearPresence(organizationId, userId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
