import { NextResponse } from "next/server";
import { getStorageStatus, isR2Configured, getStorage } from "@/lib/storage";
import { getSession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      const session = await getSession();
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const status = getStorageStatus();
    const shouldProbe =
      isR2Configured() &&
      status.active === "r2" &&
      (process.env.NODE_ENV !== "production" ||
        new URL(request.url).searchParams.get("probe") === "1");

    let r2Probe: { ok: boolean; error?: string } | null = null;
    if (shouldProbe) {
      try {
        const storage = getStorage();
        const key = await storage.upload(
          Buffer.from("headsbase-ats storage probe"),
          "probe.txt",
          "text/plain",
        );
        const read = await storage.read(key);
        await storage.delete(key);
        r2Probe = { ok: read.toString() === "headsbase-ats storage probe" };
      } catch (error) {
        r2Probe = {
          ok: false,
          error: error instanceof Error ? error.message : "R2 probe failed",
        };
      }
    }

    return NextResponse.json({
      ...status,
      hybrid: {
        database: "supabase",
        files: status.active,
      },
      probe: r2Probe,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
