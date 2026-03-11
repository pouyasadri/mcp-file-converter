import { readFile, writeFile, access } from "node:fs/promises";
import { extname, join, dirname, basename } from "node:path";
import { convertImage } from "../converters/image.js";
import { convertData } from "../converters/data.js";
import type { BatchConvertArgs } from "../types/index.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchFileResult {
  inputPath: string;
  status: "success" | "failed";
  outputPath?: string;
  error?: string;
}

export interface BatchConvertResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchFileResult[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff"]);
const DATA_EXTENSIONS  = new Set([".json", ".yaml", ".yml", ".csv", ".md", ".html", ".xlsx", ".toml", ".xml"]);

// ── Main export ───────────────────────────────────────────────────────────────

export async function batchConvert(args: BatchConvertArgs): Promise<BatchConvertResult> {
  const { inputPaths, targetExtension, overwrite, width, height, quality } = args;

  const normalizedTargetExt = targetExtension.startsWith(".")
    ? targetExtension
    : `.${targetExtension}`;

  // Process all files concurrently; failures are captured per-file, not thrown
  const settled = await Promise.allSettled(
    inputPaths.map(async (inputPath): Promise<BatchFileResult> => {
      // Verify the file exists
      try {
        await access(inputPath);
      } catch {
        throw new Error(`Source file not found: ${inputPath}`);
      }

      const sourceExt = extname(inputPath).toLowerCase();

      if (sourceExt === normalizedTargetExt.toLowerCase()) {
        throw new Error("Source and target extensions are the same. No conversion needed.");
      }

      const isImage = IMAGE_EXTENSIONS.has(sourceExt);
      const isData  = DATA_EXTENSIONS.has(sourceExt);

      const inputBuffer = await readFile(inputPath);
      let outputData: Buffer | string;

      if (isImage) {
        outputData = await convertImage(inputBuffer, normalizedTargetExt, { width, height, quality });
      } else if (isData) {
        outputData = await convertData(inputBuffer, sourceExt, normalizedTargetExt);
      } else {
        throw new Error(`Unsupported source file type: ${sourceExt}`);
      }

      const fileName = basename(inputPath, sourceExt);
      const outputPath = overwrite
        ? inputPath
        : join(dirname(inputPath), `${fileName}${normalizedTargetExt}`);

      await writeFile(outputPath, outputData);
      return { inputPath, status: "success", outputPath };
    })
  );

  // Aggregate results
  const results: BatchFileResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      inputPath: inputPaths[i] ?? "",
      status: "failed",
      error: (s.reason as Error).message,
    };
  });

  const succeeded = results.filter((r) => r.status === "success").length;

  return {
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}
