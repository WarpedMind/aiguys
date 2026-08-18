import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
  MAX_TOTAL_SIZE_BYTES,
} from "./config";
import { parseCsv } from "./sources/csv";
import { parseText } from "./sources/text";
import type { IngestResult } from "./types";

export interface InputFile {
  name: string;
  size: number;
  text: () => Promise<string>;
}

/** Strips path components and any character outside a safe filename set. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || "unnamed";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

export async function ingestFiles(files: InputFile[]): Promise<IngestResult> {
  const records: IngestResult["records"] = [];
  const warnings: IngestResult["warnings"] = [];

  if (files.length === 0) {
    throw new Error("No files provided.");
  }
  if (files.length > MAX_FILES_PER_BATCH) {
    throw new Error(
      `Too many files: ${files.length} exceeds the limit of ${MAX_FILES_PER_BATCH}.`
    );
  }

  let totalSize = 0;
  for (const file of files) {
    totalSize += file.size;
  }
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    throw new Error(
      `Batch too large: ${totalSize} bytes exceeds the limit of ${MAX_TOTAL_SIZE_BYTES} bytes.`
    );
  }

  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const ext = getExtension(safeName);

    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      warnings.push({
        sourceFile: safeName,
        message: `Skipped: unsupported file extension "${ext || "(none)"}".`,
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      warnings.push({
        sourceFile: safeName,
        message: `Skipped: file exceeds max size of ${MAX_FILE_SIZE_BYTES} bytes.`,
      });
      continue;
    }

    if (file.size === 0) {
      warnings.push({ sourceFile: safeName, message: "Skipped: empty file." });
      continue;
    }

    let content: string;
    try {
      content = await file.text();
    } catch {
      warnings.push({
        sourceFile: safeName,
        message: "Skipped: could not read file (encoding error).",
      });
      continue;
    }

    const result =
      ext === ".csv" ? parseCsv(safeName, content) : parseText(safeName, content);

    records.push(...result.records);
    warnings.push(...result.warnings);
  }

  return { records, warnings };
}
