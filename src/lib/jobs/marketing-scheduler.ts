import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";
import { processScheduledMarketingCampaigns } from "@/lib/services/marketing-scheduled-service";
import { runMarketingAutomations } from "@/lib/services/marketing-automation-runner";

const CAMPAIGN_INTERVAL_MS = Number(process.env.MARKETING_CAMPAIGN_INTERVAL_MS ?? 5 * 60 * 1000);
const AUTOMATION_INTERVAL_MS = Number(process.env.MARKETING_AUTOMATION_INTERVAL_MS ?? 24 * 60 * 60 * 1000);

let started = false;

export function startMarketingSchedulers() {
  if (started) return;
  started = true;

  registerWorker("marketing-scheduled-campaigns", true, CAMPAIGN_INTERVAL_MS);
  registerWorker("marketing-automations", true, AUTOMATION_INTERVAL_MS);

  setTimeout(() => {
    void runWorker("marketing-scheduled-campaigns", processScheduledMarketingCampaigns);
  }, 45_000);

  setInterval(() => {
    void runWorker("marketing-scheduled-campaigns", processScheduledMarketingCampaigns);
  }, CAMPAIGN_INTERVAL_MS).unref?.();

  setInterval(() => {
    void runWorker("marketing-automations", runMarketingAutomations);
  }, AUTOMATION_INTERVAL_MS).unref?.();

  console.info("[marketing] schedulers started");
}
