import Papa from "papaparse";
import type { IngestResult, RawRecord } from "../types";
import { redactRecordFields } from "../redact";

export function parseCsv(sourceFile: string, content: string): IngestResult {
  const records: RawRecord[] = [];
  const warnings: IngestResult["warnings"] = [];

  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors?.length) {
    for (const err of parsed.errors.slice(0, 10)) {
      warnings.push({
        sourceFile,
        message: `Row ${err.row ?? "?"}: ${err.message}`,
      });
    }
  }

  parsed.data.forEach((row, idx) => {
    const { cleaned, redactedFieldNames } = redactRecordFields(row);
    if (redactedFieldNames.length > 0) {
      warnings.push({
        sourceFile,
        message: `Row ${idx + 1}: redacted fields [${redactedFieldNames.join(", ")}]`,
      });
    }
    records.push({
      sourceFile,
      sourceType: "csv",
      index: idx,
      fields: cleaned,
    });
  });

  return { records, warnings };
}
