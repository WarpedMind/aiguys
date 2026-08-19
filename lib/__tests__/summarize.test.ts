import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("includes an un-generated aiSummary placeholder by default", () => {
    const summary = buildSummary({ records: [], warnings: [] });
    expect(summary.aiSummary.generated).toBe(false);
  });
});

describe("buildSummaryWithAi", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    else delete process.env.ANTHROPIC_API_KEY;
    vi.resetModules();
  });

  it("keeps the rule-based metadata and skips the AI call when no API key is configured", async () => {
    const { buildSummaryWithAi } = await import("../summarize");

    const ingest: IngestResult = {
      records: [
        { sourceFile: "a.csv", sourceType: "csv", index: 0, fields: { first_name: "Alice" } },
      ],
      warnings: [],
    };

    const summary = await buildSummaryWithAi(ingest);

    expect(summary.recordCount).toBe(1);
    expect(summary.sources).toEqual(["a.csv"]);
    expect(summary.aiSummary.generated).toBe(false);
    expect(summary.aiSummary.detail).toMatch(/ANTHROPIC_API_KEY is not configured/i);
  });
});
