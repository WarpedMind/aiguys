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
2. **Redact** ([lib/redact.ts](lib/redact.ts)) — masks likely PII (emails, SSNs,
   phone numbers, card numbers, and any field with a sensitive-sounding name)
   before the data goes any further, whether it's in a flagged field or embedded
   inside an unrelated one (e.g. a phone number inside a free-text "notes" column).
3. **Summarize** ([lib/summarize.ts](lib/summarize.ts)) — a pure function turning
   ingested records into a structured summary (counts, sources, field coverage,
   text excerpts, warnings). No I/O, so it's easy to unit test.
4. **Render** ([lib/render.ts](lib/render.ts)) — turns the structured summary into
   an HTML email body or a Slack Block Kit payload. Also pure.
5. **Deliver**
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
cp .env.example .env.local   # fill in RESEND_API_KEY and/or DEFAULT_SLACK_WEBHOOK_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload one or more
`.csv`/`.txt` files, choose a delivery channel, and submit. Delivery outcomes
and the structured summary (including which fields were redacted) are shown
in the UI.

### Testing

```bash
npm test        # vitest — redaction, ingestion validation, summary purity, webhook safety checks
npm run lint
npm run build
```

## Configuration

See [.env.example](.env.example) for the full list. Nothing is hardcoded in
source — destinations and credentials are environment-driven:

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key for sending the summary email |
| `RESEND_FROM_ADDRESS` | Verified "from" address in your Resend account |
| `DEFAULT_SUMMARY_EMAIL_TO` | Default email recipient if the caller doesn't specify one |
| `DEFAULT_SLACK_WEBHOOK_URL` | Default webhook URL (Slack incoming webhook or compatible) if the caller doesn't specify one |

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
- **PII detection is regex/heuristic-based**, tuned for common US-style
  patterns (email, SSN, phone, card number) and sensitive-sounding field
  names. It is not a substitute for a dedicated PII-detection library or
  service, and will both over- and under-redact on data it wasn't tuned for.
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
