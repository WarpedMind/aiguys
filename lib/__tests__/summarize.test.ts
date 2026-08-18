import { describe, expect, it } from "vitest";
import { buildSummary } from "../summarize";
import type { IngestResult } from "../types";

describe("buildSummary", () => {
  it("is a pure function: same input produces equivalent output shape, no side effects", () => {
    const ingest: IngestResult = {
      records: [
        { sourceFile: "a.csv", sourceType: "csv", index: 0, fields: { name: "Alice" } },
        { sourceFile: "a.csv", sourceType: "csv", index: 1, fields: { name: "Bob" } },
        { sourceFile: "b.txt", sourceType: "text", index: 0, fields: { body: "hello" } },
      ],
      warnings: [{ sourceFile: "a.csv", message: "redacted fields [email]" }],
    };

    const summary = buildSummary(ingest);

    expect(summary.recordCount).toBe(3);
    expect(summary.sources).toEqual(["a.csv", "b.txt"]);
    expect(summary.fieldCounts.name).toBe(2);
    expect(summary.textExcerpts).toEqual([{ sourceFile: "b.txt", excerpt: "hello" }]);
    expect(summary.redactedFieldNames).toContain("email");
    expect(summary.runId).toBeTruthy();
    expect(summary.generatedAt).toBeTruthy();
  });

  it("handles an empty ingest result without throwing", () => {
    const summary = buildSummary({ records: [], warnings: [] });
    expect(summary.recordCount).toBe(0);
    expect(summary.sources).toEqual([]);
  });
});
