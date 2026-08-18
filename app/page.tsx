"use client";

import { useState } from "react";
import type { DeliveryChannel, DeliveryOutcome, StructuredSummary } from "@/lib/types";

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; summary: StructuredSummary; outcomes: DeliveryOutcome[] };

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [channel, setChannel] = useState<DeliveryChannel>("email");
  const [emailTo, setEmailTo] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [result, setResult] = useState<ResultState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setResult({ status: "error", message: "Select at least one CSV or TXT file." });
      return;
    }

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("channel", channel);
    if (emailTo.trim()) formData.append("emailTo", emailTo.trim());
    if (slackWebhookUrl.trim()) formData.append("slackWebhookUrl", slackWebhookUrl.trim());

    setResult({ status: "loading" });
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setResult({ status: "error", message: data.error || "Request failed." });
        return;
      }
      setResult({ status: "done", summary: data.summary, outcomes: data.outcomes });
    } catch (err) {
      setResult({
        status: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-2xl flex-col gap-8 py-16 px-6">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Data Summary Pipeline
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Upload CSV or TXT files. They&apos;ll be cleaned, PII-redacted, and summarized,
            then delivered by email and/or Slack webhook.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-1">
              Files (.csv, .txt)
            </label>
            <input
              type="file"
              multiple
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm text-zinc-700 dark:text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-white dark:file:text-black"
            />
            {files.length > 0 && (
              <ul className="mt-2 text-xs text-zinc-500">
                {files.map((f) => (
                  <li key={f.name}>
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-1">
              Delivery channel
            </label>
            <div className="flex gap-4 text-sm text-zinc-700 dark:text-zinc-300">
              {(["email", "slack", "both"] as const).map((c) => (
                <label key={c} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="channel"
                    checked={channel === c}
                    onChange={() => setChannel(c)}
                  />
                  {c === "email" ? "Email" : c === "slack" ? "Slack" : "Both"}
                </label>
              ))}
            </div>
          </div>

          {(channel === "email" || channel === "both") && (
            <div>
              <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-1">
                Email recipient (optional — defaults to configured address)
              </label>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="tomknowsai@gmail.com"
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-black dark:text-zinc-50"
              />
            </div>
          )}

          {(channel === "slack" || channel === "both") && (
            <div>
              <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-1">
                Slack (or other platform) webhook URL (optional — defaults to configured URL)
              </label>
              <input
                type="url"
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-black dark:text-zinc-50"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={result.status === "loading"}
            className="rounded-full bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {result.status === "loading" ? "Processing…" : "Process & Send"}
          </button>
        </form>

        {result.status === "error" && (
          <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {result.message}
          </div>
        )}

        {result.status === "done" && (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50 mb-2">
                Delivery outcomes
              </h2>
              <ul className="text-sm space-y-1">
                {result.outcomes.map((o) => (
                  <li
                    key={o.channel}
                    className={o.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}
                  >
                    {o.success ? "✓" : "✗"} {o.channel}: {o.detail}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded border border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50 mb-2">
                Summary ({result.summary.recordCount} records)
              </h2>
              <p className="text-xs text-zinc-500 mb-2">Run {result.summary.runId}</p>
              {result.summary.redactedFieldNames.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                  Redacted fields: {result.summary.redactedFieldNames.join(", ")}
                </p>
              )}
              {result.summary.warnings.length > 0 && (
                <details className="text-xs text-zinc-600 dark:text-zinc-400">
                  <summary className="cursor-pointer">
                    {result.summary.warnings.length} warning(s)
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {result.summary.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
