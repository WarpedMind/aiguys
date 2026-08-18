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
