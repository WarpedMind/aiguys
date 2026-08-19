import type { StructuredSummary } from "./types";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderSummaryHtml(summary: StructuredSummary): string {
  const sourcesList = summary.sources.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  const fieldsList = summary.sampleFields
    .map((f) => `<li>${escapeHtml(f)}: ${summary.fieldCounts[f]} rows</li>`)
    .join("");
  const excerpts = summary.textExcerpts
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.sourceFile)}:</strong> ${escapeHtml(e.excerpt)}</li>`
    )
    .join("");
  const warnings = summary.warnings
    .slice(0, 20)
    .map((w) => `<li>${escapeHtml(w)}</li>`)
    .join("");
  const redacted = summary.redactedFieldNames.length
    ? `<p><strong>Redacted fields (values withheld):</strong> ${escapeHtml(
        summary.redactedFieldNames.join(", ")
      )}</p>`
    : "";

  const aiOverview = summary.aiSummary.generated
    ? `<h3>AI Summary</h3><p>${escapeHtml(summary.aiSummary.overview)}</p>`
    : "";
  const aiRecords = summary.aiSummary.generated && summary.aiSummary.records.length
    ? `<ul>${summary.aiSummary.records
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.sourceFile)} #${r.index}:</strong> ${escapeHtml(r.description)}</li>`
        )
        .join("")}</ul>`
    : "";

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2>Data Summary Report</h2>
      <p><strong>Run ID:</strong> ${escapeHtml(summary.runId)}<br/>
      <strong>Generated:</strong> ${escapeHtml(summary.generatedAt)}<br/>
      <strong>Records processed:</strong> ${summary.recordCount}</p>

      <h3>Sources</h3>
      <ul>${sourcesList || "<li>(none)</li>"}</ul>

      ${aiOverview}
      ${aiRecords}
      ${fieldsList ? `<h3>Field Coverage</h3><ul>${fieldsList}</ul>` : ""}
      ${excerpts ? `<h3>Text Excerpts</h3><ul>${excerpts}</ul>` : ""}
      ${redacted}
      ${warnings ? `<h3>Warnings</h3><ul>${warnings}</ul>` : ""}
    </div>
  `.trim();
}

export function renderSlackPayload(summary: StructuredSummary): Record<string, unknown> {
  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Data Summary Report" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Run ID:*\n${summary.runId}` },
        { type: "mrkdwn", text: `*Records:*\n${summary.recordCount}` },
        { type: "mrkdwn", text: `*Sources:*\n${summary.sources.join(", ") || "none"}` },
        { type: "mrkdwn", text: `*Generated:*\n${summary.generatedAt}` },
      ],
    },
  ];

  if (summary.aiSummary.generated) {
    const recordLines = summary.aiSummary.records
      .map((r) => `• *${r.sourceFile} #${r.index}:* ${r.description}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*AI Summary:*\n${summary.aiSummary.overview}${recordLines ? `\n\n${recordLines}` : ""}`,
      },
    });
  }

  if (summary.redactedFieldNames.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Redacted fields:* ${summary.redactedFieldNames.join(", ")}`,
      },
    });
  }

  if (summary.warnings.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Warnings (${summary.warnings.length}):*\n${summary.warnings
          .slice(0, 10)
          .map((w) => `• ${w}`)
          .join("\n")}`,
      },
    });
  }

  return {
    text: `Data Summary Report — ${summary.recordCount} records from ${summary.sources.length} source(s)`,
    blocks,
  };
}
