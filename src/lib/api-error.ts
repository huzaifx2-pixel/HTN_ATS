import { NextResponse } from "next/server";

export function getErrorStatus(message: string): number {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden" || message === "No organization found") return 403;
  if (message === "File not found" || message === "Invalid storage key") return 404;
  if (message.includes("Do Not Contact")) return 403;
  return 500;
}

export function apiErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
}
