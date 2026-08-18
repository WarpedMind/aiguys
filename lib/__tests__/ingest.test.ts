import { describe, expect, it } from "vitest";
import { ingestFiles, type InputFile } from "../ingest";

function makeFile(name: string, content: string): InputFile {
  return {
    name,
    size: Buffer.byteLength(content, "utf-8"),
    text: async () => content,
  };
}

describe("ingestFiles", () => {
  it("parses a valid CSV file into records", async () => {
    const csv = "name,amount\nAlice,10\nBob,20\n";
    const result = await ingestFiles([makeFile("data.csv", csv)]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].fields.name).toBe("Alice");
  });

  it("parses a valid text file into a single record", async () => {
    const result = await ingestFiles([makeFile("notes.txt", "hello world")]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].fields.body).toBe("hello world");
  });

  it("rejects disallowed file extensions instead of processing them", async () => {
    const result = await ingestFiles([makeFile("script.exe", "binary-ish content")]);
    expect(result.records).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/unsupported file extension/i);
  });

  it("sanitizes path-traversal attempts in filenames", async () => {
    const result = await ingestFiles([makeFile("../../etc/passwd.csv", "a,b\n1,2\n")]);
    expect(result.records[0].sourceFile).not.toContain("..");
    expect(result.records[0].sourceFile).not.toContain("/");
  });

  it("skips empty files with a warning", async () => {
    const result = await ingestFiles([makeFile("empty.csv", "")]);
    expect(result.records).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/empty file/i);
  });

  it("throws when no files are provided", async () => {
    await expect(ingestFiles([])).rejects.toThrow(/no files/i);
  });

  it("throws when batch exceeds the max file count", async () => {
    const files = Array.from({ length: 11 }, (_, i) => makeFile(`f${i}.txt`, "x"));
    await expect(ingestFiles(files)).rejects.toThrow(/too many files/i);
  });

  it("skips a file larger than the per-file size limit", async () => {
    const big: InputFile = {
      name: "big.csv",
      size: 6 * 1024 * 1024,
      text: async () => "a,b\n1,2\n",
    };
    const result = await ingestFiles([big]);
    expect(result.records).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/exceeds max size/i);
  });
});
