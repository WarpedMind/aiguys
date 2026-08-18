import { NextRequest, NextResponse } from "next/server";
import { ingestFiles, type InputFile } from "@/lib/ingest";
import { buildSummary } from "@/lib/summarize";
import { sendEmailSummary } from "@/lib/delivery/email";
import { sendWebhookSummary } from "@/lib/delivery/webhook";
import { DEFAULT_EMAIL_TO, DEFAULT_SLACK_WEBHOOK_URL } from "@/lib/config";
import type { DeliveryChannel, DeliveryOutcome } from "@/lib/types";

export const runtime = "nodejs";

function isValidChannel(value: unknown): value is DeliveryChannel {
  return value === "email" || value === "slack" || value === "both";
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const channelRaw = formData.get("channel");
  const channel: DeliveryChannel = isValidChannel(channelRaw) ? channelRaw : "email";

  const emailToRaw = formData.get("emailTo");
  const emailTo =
    typeof emailToRaw === "string" && emailToRaw.trim() ? emailToRaw.trim() : DEFAULT_EMAIL_TO;

  const slackUrlRaw = formData.get("slackWebhookUrl");
  const slackWebhookUrl =
    typeof slackUrlRaw === "string" && slackUrlRaw.trim()
      ? slackUrlRaw.trim()
      : DEFAULT_SLACK_WEBHOOK_URL;

  const fileEntries = formData.getAll("files").filter((f): f is File => f instanceof File);

  const inputFiles: InputFile[] = fileEntries.map((f) => ({
    name: f.name,
    size: f.size,
    text: () => f.text(),
  }));

  let ingestResult;
  try {
    ingestResult = await ingestFiles(inputFiles);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed." },
      { status: 400 }
    );
  }

  const summary = buildSummary(ingestResult);

  const outcomes: DeliveryOutcome[] = [];

  if (channel === "email" || channel === "both") {
    const result = await sendEmailSummary(summary, emailTo);
    outcomes.push({ channel: "email", success: result.success, detail: result.detail });
  }

  if (channel === "slack" || channel === "both") {
    if (!slackWebhookUrl) {
      outcomes.push({
        channel: "slack",
        success: false,
        detail: "No Slack webhook URL configured.",
      });
    } else {
      const result = await sendWebhookSummary(summary, slackWebhookUrl);
      outcomes.push({ channel: "slack", success: result.success, detail: result.detail });
    }
  }

  // Log only metadata — never raw file contents, field values, or destination secrets.
  console.log(
    JSON.stringify({
      event: "ingest_run",
      runId: summary.runId,
      recordCount: summary.recordCount,
      sources: summary.sources,
      channel,
      outcomes: outcomes.map((o) => ({ channel: o.channel, success: o.success })),
    })
  );

  return NextResponse.json({ summary, outcomes });
}
