import { NextResponse } from "next/server";
import { getStorageStatus, isR2Configured, getStorage } from "@/lib/storage";
import { getSession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      const session = await getSession();
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const status = getStorageStatus();

    let r2Probe: { ok: boolean; error?: string } | null = null;
    if (process.env.NODE_ENV !== "production" && isR2Configured()) {
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
      probe: r2Probe,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
