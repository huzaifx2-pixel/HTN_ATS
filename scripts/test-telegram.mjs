import "dotenv/config";
import {
  sendTelegramTestMessage,
  notifyNewCandidate,
} from "../src/lib/services/telegram-notification-service.ts";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("FAIL: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in .env");
    process.exit(1);
  }

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) {
    console.error("FAIL: bot token invalid", me);
    process.exit(1);
  }
  console.log("OK: bot authenticated as", me.result.username);

  await sendTelegramTestMessage();
  notifyNewCandidate({
    id: "test12345",
    firstName: "Test",
    lastName: "Candidate",
    skills: ["Python", "AWS", "React"],
    experienceYears: 6,
    location: "Texas",
    country: "USA",
    source: "UPLOAD",
  });

  await new Promise((r) => setTimeout(r, 2500));
  console.log("OK: test notifications sent to chat", chatId);
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
