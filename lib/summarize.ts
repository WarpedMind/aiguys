import { randomUUID } from "crypto";
import type { IngestResult, StructuredSummary } from "./types";

const MAX_EXCERPT_LENGTH = 280;
const MAX_EXCERPTS = 5;

/** Pure transform: raw ingested records -> structured summary. No I/O. */
export function buildSummary(ingest: IngestResult): StructuredSummary {
  const { records, warnings } = ingest;

  const sources = Array.from(new Set(records.map((r) => r.sourceFile)));
  const fieldCounts: Record<string, number> = {};
  const redactedFieldNames = new Set<string>();
  const textExcerpts: StructuredSummary["textExcerpts"] = [];

  for (const record of records) {
    for (const key of Object.keys(record.fields)) {
      if (record.sourceType === "csv") {
        fieldCounts[key] = (fieldCounts[key] || 0) + 1;
      }
    }

    if (record.sourceType === "text" && textExcerpts.length < MAX_EXCERPTS) {
      const body = record.fields.body || "";
      textExcerpts.push({
        sourceFile: record.sourceFile,
        excerpt:
          body.length > MAX_EXCERPT_LENGTH
            ? `${body.slice(0, MAX_EXCERPT_LENGTH)}…`
            : body,
      });
    }
  }

  for (const w of warnings) {
    const match = w.message.match(/redacted fields \[(.+)\]/i);
    if (match) {
      match[1].split(",").forEach((f) => redactedFieldNames.add(f.trim()));
    }
  }

  return {
    runId: randomUUID(),
    generatedAt: new Date().toISOString(),
    sources,
    recordCount: records.length,
    fieldCounts,
    sampleFields: Object.keys(fieldCounts).slice(0, 20),
    textExcerpts,
    warnings: warnings.map((w) => `[${w.sourceFile}] ${w.message}`),
    redactedFieldNames: Array.from(redactedFieldNames),
  };
}
