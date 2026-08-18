import { Resend } from "resend";
import { RESEND_API_KEY, RESEND_FROM_ADDRESS } from "../config";
import type { StructuredSummary } from "../types";
import { renderSummaryHtml } from "../render";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function sendEmailSummary(
  summary: StructuredSummary,
  to: string
): Promise<{ success: boolean; detail: string }> {
  if (!EMAIL_RE.test(to)) {
    return { success: false, detail: "Invalid recipient email address." };
  }
  if (!RESEND_API_KEY) {
    return {
      success: false,
      detail: "Email not sent: RESEND_API_KEY is not configured.",
    };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: RESEND_FROM_ADDRESS,
      to,
      subject: `Data Summary Report — ${summary.recordCount} records (${summary.runId.slice(0, 8)})`,
      html: renderSummaryHtml(summary),
    });

    if (error) {
      return { success: false, detail: `Resend error: ${error.message}` };
    }
    return { success: true, detail: `Sent to ${to}` };
  } catch (err) {
    return {
      success: false,
      detail: `Email delivery failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
