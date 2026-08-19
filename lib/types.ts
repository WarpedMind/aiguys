export interface RawRecord {
  sourceFile: string;
  sourceType: "csv" | "text";
  index: number;
  fields: Record<string, string>;
}

export interface IngestWarning {
  sourceFile: string;
  message: string;
}

export interface IngestResult {
  records: RawRecord[];
  warnings: IngestWarning[];
}

export interface AiRecordSummary {
  sourceFile: string;
  index: number;
  /** Short natural-language description of this record's content, built only from non-PII fields. */
  description: string;
}

export interface AiSummary {
  /** Short natural-language overview of the whole batch. */
  overview: string;
  records: AiRecordSummary[];
  /** True when the AI step ran; false when it was skipped (e.g. no API key configured) or failed. */
  generated: boolean;
  /** Explains why `generated` is false, or how the call went if it succeeded. */
  detail: string;
}

export interface StructuredSummary {
  runId: string;
  generatedAt: string;
  sources: string[];
  recordCount: number;
  fieldCounts: Record<string, number>;
  sampleFields: string[];
  textExcerpts: { sourceFile: string; excerpt: string }[];
  warnings: string[];
  redactedFieldNames: string[];
  aiSummary: AiSummary;
}

export type DeliveryChannel = "email" | "slack" | "both";

export interface DeliveryRequest {
  channel: DeliveryChannel;
  emailTo?: string;
  slackWebhookUrl?: string;
}

export interface DeliveryOutcome {
  channel: "email" | "slack";
  success: boolean;
  detail: string;
}
