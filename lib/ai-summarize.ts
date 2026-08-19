import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANTHROPIC_API_KEY } from "./config";
import type { AiSummary, RawRecord } from "./types";

const MAX_RECORDS_FOR_AI = 50;

const AiSummarySchema = z.object({
  overview: z
    .string()
    .describe("A short (2-4 sentence) natural-language overview of the whole batch of records."),
  records: z
    .array(
      z.object({
        index: z.number().describe("The record's index as given in the input."),
        description: z
          .string()
          .describe(
            "A one-sentence natural-language description of this record's content, using only the fields provided."
          ),
      })
    )
    .describe("One entry per input record, in the same order."),
});

/**
 * Sends already-redacted record fields to Claude to produce a natural-language
 * structured summary. Callers must ensure `records` have already been through
 * lib/redact.ts — this function does not redact and assumes its input is safe
 * to send to a third-party API.
 */
export async function generateAiSummary(records: RawRecord[]): Promise<AiSummary> {
  if (!ANTHROPIC_API_KEY) {
    return {
      overview: "",
      records: [],
      generated: false,
      detail: "AI summary skipped: ANTHROPIC_API_KEY is not configured.",
    };
  }

  if (records.length === 0) {
    return {
      overview: "No records to summarize.",
      records: [],
      generated: true,
      detail: "No records in batch — nothing sent to the API.",
    };
  }

  const truncated = records.slice(0, MAX_RECORDS_FOR_AI);
  const payload = truncated.map((r, i) => ({
    index: i,
    sourceFile: r.sourceFile,
    fields: r.fields,
  }));

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system:
        "You summarize already-sanitized data records. The fields you receive have already " +
        "had PII (emails, phone numbers, SSNs) redacted by the caller — treat any remaining " +
        "field (e.g. first_name, last_name, subject, amount, notes) as safe to describe " +
        "directly. Do not speculate about redacted or missing information. Be concise and factual.",
      messages: [
        {
          role: "user",
          content:
            "Summarize this batch of records. Provide a short overview and, for each record, " +
            "a one-sentence description grounded only in the fields given:\n\n" +
            JSON.stringify(payload, null, 2),
        },
      ],
      output_config: { format: zodOutputFormat(AiSummarySchema) },
    });

    if (!response.parsed_output) {
      return {
        overview: "",
        records: [],
        generated: false,
        detail: "AI summary failed: model response did not match the expected schema.",
      };
    }

    const parsed = response.parsed_output;
    const bySourceFile = truncated.map((r) => r.sourceFile);

    return {
      overview: parsed.overview,
      records: parsed.records.map((r) => ({
        sourceFile: bySourceFile[r.index] ?? "unknown",
        index: r.index,
        description: r.description,
      })),
      generated: true,
      detail:
        records.length > truncated.length
          ? `Summarized first ${truncated.length} of ${records.length} records.`
          : `Summarized ${truncated.length} record(s).`,
    };
  } catch (err) {
    return {
      overview: "",
      records: [],
      generated: false,
      detail: `AI summary failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
