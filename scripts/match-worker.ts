import { resolve } from "path";
import { config } from "dotenv";
import { startMatchQueueProcessor } from "../src/lib/queue/match-processor";

config({ path: resolve(process.cwd(), ".env") });

startMatchQueueProcessor({ standalone: true });
console.info("Match worker running. Ctrl+C to stop.");
