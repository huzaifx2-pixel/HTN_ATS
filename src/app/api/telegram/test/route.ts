import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";
import { sendTelegramTestMessage } from "@/lib/services/telegram-notification-service";

export async function POST() {
  try {
    await requireSession();

    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env" },
        { status: 400 }
      );
    }

    try {
      await sendTelegramTestMessage();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test message failed";
      if (message.includes("turned off")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
