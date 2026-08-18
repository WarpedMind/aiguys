import { renderSlackPayload } from "../render";
import type { StructuredSummary } from "../types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 8000;

// RFC1918 / loopback / link-local ranges — block direct IP-literal targets to
// reduce (not eliminate) SSRF risk from a user-supplied webhook URL. DNS
// resolution to an internal address is not covered here; a production system
// should resolve and check the actual IP before connecting.
const PRIVATE_IP_RE =
  /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|::1$|localhost$)/i;

export function isSafeWebhookUrl(rawUrl: string): { safe: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Not a valid URL." };
  }
  if (url.protocol !== "https:") {
    return { safe: false, reason: "Webhook URL must use HTTPS." };
  }
  if (PRIVATE_IP_RE.test(url.hostname)) {
    return { safe: false, reason: "Webhook URL points to a private/internal address." };
  }
  return { safe: true };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends the summary to a generic JSON webhook (Slack incoming-webhook shaped
 * by default). The payload builder is swappable so other platforms (Discord,
 * Teams, a custom client endpoint) can be supported later without touching
 * the retry/transport logic.
 */
export async function sendWebhookSummary(
  summary: StructuredSummary,
  webhookUrl: string,
  buildPayload: (s: StructuredSummary) => Record<string, unknown> = renderSlackPayload
): Promise<{ success: boolean; detail: string }> {
  const check = isSafeWebhookUrl(webhookUrl);
  if (!check.safe) {
    return { success: false, detail: `Webhook rejected: ${check.reason}` };
  }

  const payload = buildPayload(summary);

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        return { success: true, detail: `Webhook delivered (status ${res.status})` };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : "unknown network error";
    }

    if (attempt < MAX_RETRIES) {
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  return {
    success: false,
    detail: `Webhook delivery failed after ${MAX_RETRIES} attempts: ${lastError}`,
  };
}
