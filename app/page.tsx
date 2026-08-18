import UploadForm from "./upload-form";
import { DEFAULT_EMAIL_TO } from "@/lib/config";

export default function Home() {
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

        <UploadForm defaultEmailTo={DEFAULT_EMAIL_TO} />
      </main>
    </div>
  );
}
