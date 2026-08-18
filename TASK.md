# Task: Multi-Source Data Ingestion → Structured Summary → Delivery

## Objective
Build a pipeline that:
1. Ingests data from multiple input sources (CSV files, plain text files, extensible to more).
2. Cleans, normalizes, and structures that data into a coherent summary.
3. Delivers the summary via one of two configurable channels: email (to a specified address) or webhook (to a specified platform endpoint).

## Scope
- Single-run, invocable as a CLI/script or scheduled job — not a long-running service.
- Input sources and destination are both configuration-driven, not hardcoded.
- Output format: structured summary (e.g., JSON internally, rendered to Markdown/HTML for email, JSON for webhook).

---

## 1. Input Layer

### Requirements
- Support at minimum: `.csv` and `.txt` files from a local directory or provided file list.
- Design the reader as a pluggable interface (`SourceReader`) so new formats (JSON, XLSX, API pull) can be added without touching downstream logic.
- Each reader returns a common intermediate representation (e.g., list of records/rows or list of text blocks with metadata: source filename, ingestion timestamp).

### Validation
- Reject or quarantine files that fail basic sanity checks (empty, malformed encoding, exceeds size limit).
- Enforce an explicit allowlist of accepted file extensions — do not process arbitrary file types.
- Set a max file size / max total batch size to bound memory usage.

### Security & Privacy (input-specific)
- Treat all input file paths as untrusted: resolve and validate against an allowed base directory (prevent path traversal, e.g. `../../etc/passwd`).
- If inputs may contain PII (names, emails, SSNs, account numbers, etc.), identify and tag sensitive fields at ingestion time so downstream stages know what they're handling — don't let PII silently flow through untagged.
- Do not log raw file contents. Log only metadata (filename, row count, timestamp, byte size).

---

## 2. Processing / Cleaning Layer

### Requirements
- Normalize inconsistent formatting: whitespace, date formats, casing, encoding (UTF-8 enforced).
- Deduplicate records where applicable.
- Handle missing/malformed fields with an explicit policy (drop row, fill default, flag for review) — not silent coercion.
- Aggregate/summarize across sources into a single structured schema, e.g.:
  ```json
  {
    "run_id": "uuid",
    "generated_at": "ISO-8601 timestamp",
    "sources": ["file1.csv", "file2.txt"],
    "record_count": 123,
    "summary": { ... domain-specific structured fields ... },
    "warnings": ["row 45 in file1.csv: missing required field 'date'"]
  }
  ```

### Security & Privacy (processing-specific)
- If PII was tagged at ingestion, apply a redaction/masking step here for any PII not strictly required in the final summary (e.g., mask all but last 4 digits of an account number).
- Keep a clear boundary: only fields explicitly needed in the output summary should survive past this stage. Everything else gets dropped, not just "unused."
- No PII or sensitive data in error messages, stack traces, or warning strings that might get surfaced downstream (e.g., don't put a person's SSN into a `warnings` array).

---

## 3. Output Layer

### Requirements
- Render the structured summary into:
  - Human-readable format for email (HTML or Markdown-to-HTML).
  - Machine-readable JSON payload for webhook delivery.
- Output rendering should be a separate, pure function of the structured summary (no side effects, no re-fetching data) — easy to test independently of delivery.

---

## 4. Delivery Layer

Two delivery mechanisms, selected via config (not both required per run, but both supported):

### 4a. Email delivery
- Use an authenticated transactional email provider (e.g., SES, SendGrid, Postmark) rather than raw SMTP with hardcoded credentials.
- Recipient address comes from config/environment, never hardcoded in source.
- Subject/body should not include unmasked PII beyond what's explicitly intended for that recipient.

### 4b. Webhook delivery
- POST JSON payload to a configured URL.
- Sign the payload (HMAC-SHA256 with a shared secret) and include the signature in a header (e.g., `X-Signature`) so the receiving platform can verify authenticity — this also protects against payload tampering in transit.
- Enforce HTTPS-only endpoints; reject `http://` webhook URLs.
- Set a reasonable timeout and retry policy (e.g., 3 attempts with exponential backoff) — do not retry indefinitely.
- Validate the destination URL isn't pointing at internal/private IP ranges (SSRF protection) if the URL is ever user-supplied at runtime rather than fixed in config.

### Security & Privacy (delivery-specific)
- All secrets (SMTP/API keys, webhook HMAC secret) come from environment variables or a secrets manager — never committed to source, never logged.
- Log delivery attempts (success/failure, timestamp, destination identifier) but not payload contents.
- Fail closed: if delivery fails, do not silently drop the summary — surface an error and retain the output locally (or in a dead-letter location) for manual follow-up.

---

## 5. Configuration

- All of the following must be externally configurable (env vars / config file, not hardcoded):
  - Input directory / source file list
  - Allowed file extensions and size limits
  - Delivery mode (email | webhook) and destination (address or URL)
  - Credentials/secrets (referenced by name, sourced from env or secrets manager)
- Provide a `.env.example` (or equivalent) listing required variable names with no real values.

---

## 6. Testing & Verification Checklist

Before considering this "done":
- [ ] Unit tests for each `SourceReader` (valid input, malformed input, oversized input, path traversal attempt).
- [ ] Unit tests for the cleaning/normalization stage, including PII redaction logic.
- [ ] Unit tests for output rendering (structured summary → HTML/JSON) with no side effects.
- [ ] Integration test for webhook delivery: valid signature generated, HTTPS enforced, retry/backoff behaves correctly on simulated failure.
- [ ] Integration test for email delivery against a sandbox/test provider (not a real inbox).
- [ ] Confirm no secrets, PII, or raw file contents appear in logs (manual log review or automated log-scan test).
- [ ] Confirm `.gitignore` excludes any local `.env`, sample data with real PII, or output artifacts.
- [ ] Run a static security scan (e.g., dependency audit, secret scanner) before first commit.

---

## Open Decisions (fill in before/while implementing)
- Language/runtime (Python, Node/TypeScript, etc.)
- Email provider (SES / SendGrid / Postmark / other)
- Structured summary schema specifics — depends on the actual domain data (what does "cleaned-up structured summary" mean for your specific CSV/text content?)
- Trigger mechanism: manual run, cron, or event-driven (e.g., new file dropped in a watched folder)
