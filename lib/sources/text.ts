import type { IngestResult, RawRecord } from "../types";
import { redactText } from "../redact";

export function parseText(sourceFile: string, content: string): IngestResult {
  const warnings: IngestResult["warnings"] = [];

  const { redacted, hits } = redactText(content);
  if (hits > 0) {
    warnings.push({
      sourceFile,
      message: `Redacted ${hits} likely-PII match(es) from free text`,
    });
  }

  const record: RawRecord = {
    sourceFile,
    sourceType: "text",
    index: 0,
    fields: { body: redacted.trim() },
  };

  return { records: [record], warnings };
}
