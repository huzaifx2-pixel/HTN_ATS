import { prisma } from "@/lib/db";

export type SystemLogLevel = "info" | "warn" | "error";

export async function logSystemEvent(input: {
  organizationId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  level?: SystemLogLevel;
  actorId?: string;
}) {
  const level = input.level ?? "info";
  const payload = {
    action: input.action,
    entityType: input.entityType ?? "system",
    entityId: input.entityId,
    ...(input.metadata ?? {}),
  };

  const line = `[${input.action}] ${JSON.stringify(payload)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);

  if (!input.organizationId) return;

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType ?? "system",
        entityId: input.entityId,
        metadata: payload as object,
      },
    });
  } catch (error) {
    console.error("[system-log] failed to persist audit entry", error);
  }
}
