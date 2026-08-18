// Best-effort PII detection for a code test. Not exhaustive — real deployments
// should use a dedicated PII-detection library/service tuned to the actual data domain.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE_RE = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const CREDIT_CARD_RE = /\b(?:\d[ -]?){13,16}\b/g;

const SENSITIVE_FIELD_NAME_RE =
  /^(ssn|social.?security|email|e-?mail|phone|mobile|dob|date.?of.?birth|credit.?card|card.?number|account.?number|password|address|street)$/i;

function maskValue(value: string): string {
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

/** Redacts known PII patterns within free text (used for .txt sources). */
export function redactText(text: string): { redacted: string; hits: number } {
  let hits = 0;
  const redacted = text
    .replace(EMAIL_RE, () => {
      hits++;
      return "[REDACTED_EMAIL]";
    })
    .replace(SSN_RE, () => {
      hits++;
      return "[REDACTED_SSN]";
    })
    .replace(CREDIT_CARD_RE, () => {
      hits++;
      return "[REDACTED_CARD]";
    })
    .replace(PHONE_RE, () => {
      hits++;
      return "[REDACTED_PHONE]";
    });
  return { redacted, hits };
}

/**
 * Redacts a CSV record's fields based on field name heuristics and value patterns.
 * Returns the cleaned record plus the list of field names that were redacted,
 * so downstream stages can report what was withheld without exposing the values.
 *
 * Fields whose name looks sensitive (e.g. "ssn", "email") are fully masked.
 * Every other field is scanned for embedded PII patterns (email/SSN/phone/card
 * substrings, e.g. a phone number inside a free-text "notes" column) and only
 * those substrings are scrubbed, so unrelated content in the same field survives.
 */
export function redactRecordFields(
  fields: Record<string, string>
): { cleaned: Record<string, string>; redactedFieldNames: string[] } {
  const cleaned: Record<string, string> = {};
  const redactedFieldNames: string[] = [];

  for (const [key, rawValue] of Object.entries(fields)) {
    const value = rawValue ?? "";
    const fieldLooksSensitive = SENSITIVE_FIELD_NAME_RE.test(key.trim());

    if (fieldLooksSensitive) {
      cleaned[key] = maskValue(value);
      redactedFieldNames.push(key);
      continue;
    }

    const { redacted, hits } = redactText(value);
    if (hits > 0) {
      cleaned[key] = redacted;
      redactedFieldNames.push(key);
    } else {
      cleaned[key] = value;
    }
  }

  return { cleaned, redactedFieldNames };
}
