import { getProviderUsageCount, incrementProviderUsage } from "~/lib/db/queries/provider-usage";
import env from "~/lib/env";

const TRIPADVISOR_PROVIDER = "tripadvisor";

function tripAdvisorWindowKeys() {
  // UTC day/month buckets keep the keys stable regardless of server timezone.
  const iso = new Date().toISOString();
  return {
    day: `${TRIPADVISOR_PROVIDER}:day:${iso.slice(0, 10)}`,
    month: `${TRIPADVISOR_PROVIDER}:month:${iso.slice(0, 7)}`,
  };
}

// Billing guard for the paid TripAdvisor photos endpoint. True when the day or month cap is hit.
// Fails CLOSED (errors → "exceeded"): for a billable provider it is safer to skip a photo than to
// risk uncapped spend if the usage store is unavailable.
export async function isTripAdvisorQuotaExceeded(): Promise<boolean> {
  try {
    const { day, month } = tripAdvisorWindowKeys();
    const [dayCount, monthCount] = await Promise.all([
      getProviderUsageCount(day),
      getProviderUsageCount(month),
    ]);

    return dayCount >= env.TRIPADVISOR_DAILY_LIMIT || monthCount >= env.TRIPADVISOR_MONTHLY_LIMIT;
  }
  catch {
    return true;
  }
}

// Records one billable TripAdvisor call against the day and month counters. Best-effort: the
// pre-call gate is the real protection, and TripAdvisor's own daily budget is the hard backstop.
export async function recordTripAdvisorCall(): Promise<void> {
  try {
    const { day, month } = tripAdvisorWindowKeys();
    await incrementProviderUsage([day, month]);
  }
  catch {
    // Swallow — see note above.
  }
}
