import { describe, expect, it } from "vitest";
import { redactRecordFields, redactText } from "../redact";

describe("redactRecordFields", () => {
  it("masks fields with sensitive names", () => {
    const { cleaned, redactedFieldNames } = redactRecordFields({
      name: "Jane Doe",
      email: "jane@example.com",
      ssn: "123-45-6789",
    });
    expect(cleaned.email).not.toBe("jane@example.com");
    expect(cleaned.ssn).not.toBe("123-45-6789");
    expect(cleaned.name).toBe("Jane Doe");
    expect(redactedFieldNames).toContain("email");
    expect(redactedFieldNames).toContain("ssn");
    expect(redactedFieldNames).not.toContain("name");
  });

  it("masks values that look like PII even under an innocuous field name", () => {
    const { cleaned, redactedFieldNames } = redactRecordFields({
      notes: "contact jane@example.com for details",
    });
    expect(redactedFieldNames).toContain("notes");
    expect(cleaned.notes).not.toContain("jane@example.com");
  });

  it("preserves the last 4 characters for traceability on longer values", () => {
    const { cleaned } = redactRecordFields({ ssn: "123-45-6789" });
    expect(cleaned.ssn.endsWith("6789")).toBe(true);
  });

  it("redacts a phone number embedded in an unrelated field like 'notes'", () => {
    const { cleaned, redactedFieldNames } = redactRecordFields({
      notes: "Contact 555-123-4567",
    });
    expect(cleaned.notes).not.toContain("555-123-4567");
    expect(redactedFieldNames).toContain("notes");
  });

  it("leaves fields with no PII and no sensitive name untouched", () => {
    const { cleaned, redactedFieldNames } = redactRecordFields({
      notes: "Paid in full",
      amount: "150.00",
    });
    expect(cleaned.notes).toBe("Paid in full");
    expect(cleaned.amount).toBe("150.00");
    expect(redactedFieldNames).toHaveLength(0);
  });

  it("passes first_name, last_name, and subject through untouched while scrubbing email/phone/SSN in the same record", () => {
    const before = {
      first_name: "Alice",
      last_name: "Smith",
      subject: "Invoice payment",
      email: "alice@example.com",
      notes: "Contact 555-123-4567, SSN 123-45-6789 on file",
    };

    const { cleaned, redactedFieldNames } = redactRecordFields(before);

    // Non-PII fields pass through byte-for-byte.
    expect(cleaned.first_name).toBe(before.first_name);
    expect(cleaned.last_name).toBe(before.last_name);
    expect(cleaned.subject).toBe(before.subject);

    // PII fields/values are scrubbed.
    expect(cleaned.email).not.toBe(before.email);
    expect(cleaned.notes).not.toContain("555-123-4567");
    expect(cleaned.notes).not.toContain("123-45-6789");

    expect(redactedFieldNames).toContain("email");
    expect(redactedFieldNames).toContain("notes");
    expect(redactedFieldNames).not.toContain("first_name");
    expect(redactedFieldNames).not.toContain("last_name");
    expect(redactedFieldNames).not.toContain("subject");
  });
});

describe("redactText", () => {
  it("redacts emails, ssns, and phone numbers from free text", () => {
    const { redacted, hits } = redactText(
      "Reach Jane at jane@example.com or 555-123-4567. SSN 123-45-6789."
    );
    expect(redacted).not.toContain("jane@example.com");
    expect(redacted).not.toContain("123-45-6789");
    expect(hits).toBeGreaterThan(0);
  });

  it("leaves non-PII text untouched", () => {
    const { redacted, hits } = redactText("Quarterly revenue increased by 12%.");
    expect(redacted).toBe("Quarterly revenue increased by 12%.");
    expect(hits).toBe(0);
  });
});
