# aiguys — Data Summary Pipeline

A Next.js app that ingests CSV/TXT files, redacts likely PII, produces a
structured summary, and delivers it by email and/or a platform webhook
(Slack by default, built to be swappable to other platforms). Built as a
timeboxed code test, deployed on Vercel.

The original task specification is in [TASK.md](TASK.md).

## What it does

1. **Ingest** ([lib/ingest.ts](lib/ingest.ts)) — validates uploaded files against
   an extension allowlist (`.csv`, `.txt`) and size limits (5MB/file, 20MB/batch,
   10 files max), sanitizes filenames (no path traversal), and parses each file:
   - [lib/sources/csv.ts](lib/sources/csv.ts) — CSV rows via PapaParse.
   - [lib/sources/text.ts](lib/sources/text.ts) — plain text as a single block.
2. **Redact** ([lib/redact.ts](lib/redact.ts)) — masks PII matching email, phone,
   and SSN patterns (plus card-number patterns and any field with a
   sensitive-sounding name) before the data goes any further, whether it's in a
   flagged field or embedded inside an unrelated one (e.g. a phone number inside
   a free-text "notes" column). See [Known limitations](#known-limitations) for
   what this does and doesn't catch.
3. **Summarize** ([lib/summarize.ts](lib/summarize.ts)) — `buildSummary()` is a
   pure function turning ingested records into rule-based structured metadata
   (counts, sources, field coverage, text excerpts, warnings). No I/O, so it's
   easy to unit test.
4. **AI summarize** ([lib/ai-summarize.ts](lib/ai-summarize.ts)) — `buildSummaryWithAi()`
   layers a natural-language summary on top via a real Claude API call
   (`claude-opus-5`, structured output via Zod). It receives only the
   already-redacted record fields — never raw file content — and returns an
   overview plus a one-sentence description per record, referencing whatever
   non-PII fields are present (e.g. `first_name`, `last_name`, `subject`). If
   `ANTHROPIC_API_KEY` isn't set, this step is skipped and the rule-based
   metadata from step 3 is still returned — the pipeline degrades gracefully
   rather than failing the whole request.
5. **Render** ([lib/render.ts](lib/render.ts)) — turns the structured summary into
   an HTML email body or a Slack Block Kit payload, including the AI overview
   and per-record descriptions when available. Also pure.
6. **Deliver**
   - [lib/delivery/email.ts](lib/delivery/email.ts) — sends via [Resend](https://resend.com).
   - [lib/delivery/webhook.ts](lib/delivery/webhook.ts) — POSTs to a webhook URL,
     enforcing HTTPS, blocking private/loopback IP targets, and retrying with
     exponential backoff. The payload builder is a parameter — Slack's shape is
     just the default, so another platform's format can be swapped in later
     without touching the transport/retry logic.

The client can choose **email**, **Slack/webhook**, or **both** per request.
Defaults (overridable per request) live in environment variables.

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload one or more
`.csv`/`.txt` files, choose a delivery channel (Email, Slack, or Both), and
submit. Delivery outcomes and the structured summary (including which fields
were redacted) are shown in the UI. The email-recipient field's placeholder
reflects whatever `DEFAULT_SUMMARY_EMAIL_TO` is actually set to in your
environment, not a hardcoded example.

**Try it yourself:** upload [examples/sample.csv](examples/sample.csv) and
[examples/sample.txt](examples/sample.txt) through the UI to see extraction
and redaction in action — both files contain synthetic PII (fake emails, a
fake SSN, a fake phone number) specifically to demonstrate the redaction
step.

### Testing

```bash
npm test        # vitest — redaction, ingestion validation, summary purity, webhook safety checks
npm run lint
npm run build
```

## Configuration

Set these in `.env.local` (see [.env.example](.env.example) for the template).
Nothing is hardcoded in source — destinations and credentials are entirely
environment-driven, and either channel can be used standalone or together.

**Email delivery** (via [Resend](https://resend.com)):

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Your Resend API key. Without this set, email delivery fails closed with a clear error — it does not silently no-op. |
| `RESEND_FROM_ADDRESS` | A verified "from" address in your Resend account. |
| `DEFAULT_SUMMARY_EMAIL_TO` | Default recipient used when the UI's recipient field is left blank. |

**Slack / webhook delivery**:

| Variable | Purpose |
|---|---|
| `DEFAULT_SLACK_WEBHOOK_URL` | Default incoming-webhook URL (Slack, or any endpoint that accepts the same JSON shape) used when the UI's webhook field is left blank. Must be HTTPS. |

Both defaults can be overridden per-request from the UI without touching
environment config — useful for sending a one-off summary somewhere other
than the configured default.

**AI summary generation:**

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key used to generate the natural-language overview and per-record descriptions. Without it, the AI step is skipped and the response falls back to rule-based metadata only — the request still succeeds. |

## Deploying to Vercel

```bash
vercel
```

Set the variables above as environment variables in the Vercel project
settings — not in source, not in a committed file.

## Security notes

- Uploads are capped in size/count and restricted to `.csv`/`.txt`.
- Filenames are sanitized before use anywhere (logs, display, source labels) —
  path traversal attempts are stripped.
- PII patterns are redacted before summarization or rendering; only the
  redacted *field names* are reported downstream, never the original values.
- The AI summary step ([lib/ai-summarize.ts](lib/ai-summarize.ts)) only ever
  receives record fields that have already passed through the redaction step
  above — it has no path to raw file content. Verified live: see
  [Known limitations](#known-limitations) for what redaction does and doesn't
  catch, since that's the actual boundary the AI call trusts.
- Webhook URLs must be HTTPS and are checked against private/loopback IP
  ranges before use.
- Delivery failures fail closed and are surfaced in the response instead of
  being silently dropped.
- The API route logs only run metadata (filenames, record counts,
  success/failure per channel) — never field values, file contents, or
  destination addresses. Verified manually against real server logs during
  development.
- No secrets are committed. `.env.example` documents required variable names
  with empty values only.

## Known limitations

- **PII redaction covers email, phone, and SSN patterns specifically** (plus
  card-number patterns and fields with sensitive-sounding names like `ssn` or
  `email`). It is a pattern-based filter, **not a full PII-detection
  solution** — it has no coverage for unstructured PII such as person names,
  street addresses as free text, or ID formats outside what it explicitly
  matches (e.g. non-US phone/ID formats, passport numbers, driver's license
  numbers). Data containing PII shapes this build doesn't recognize will pass
  through unredacted — and since the AI summary step trusts redaction's
  output, unrecognized PII would also reach the Claude API call.
- **The AI summary step sends redacted record data to a third-party API**
  (Anthropic). If your `.csv`/`.txt` inputs contain sensitive business data
  in fields that aren't PII-shaped (and therefore aren't redacted — see
  above), that data is included in the prompt sent for summarization.

## Out of scope for this build

This was built in a single-session timebox as a code test, not a production
system. Notably absent, and what a next phase would add:

- **Webhook payload signing (HMAC).** The original spec calls for signing
  outbound webhook payloads (e.g. HMAC-SHA256 in an `X-Signature` header) so
  the receiving platform can verify authenticity and detect tampering. This
  build enforces HTTPS and blocks private-IP targets, but does not sign
  payloads — anyone with the webhook URL could currently spoof a request.
- **SSRF protection is hostname-based, not DNS-resolved.** The private-IP
  check inspects the literal hostname in the URL; a hostname that resolves to
  an internal address via DNS would not be caught. A production system should
  resolve the hostname and check the actual IP before connecting.
- **Only CSV and plain text sources.** The reader interface is pluggable, but
  no other formats (JSON, XLSX, API pull) are implemented.
- **No persistence.** Each run is stateless — there's no run history, no
  dead-letter storage for failed deliveries, and no way to re-send a past
  summary. A failed delivery is reported in the response but not retained
  server-side.
- **No auth on the upload endpoint.** The API route is open to anyone who can
  reach it; a production deployment would need to gate uploads (e.g. behind
  login, an API key, or a signed upload link) given it can trigger outbound
  email/webhook sends.
- **Single email provider, no HMAC secret rotation, no per-tenant config.**
  Delivery config is a single set of environment variables, not
  multi-tenant or dynamically configurable at runtime beyond the two
  request-level overrides (recipient, webhook URL).

## License

MIT — see [LICENSE](LICENSE).
