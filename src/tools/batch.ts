import { readFile, writeFile, access } from "fs/promises";
import { extname } from "path";
import { convertImage } from "../converters/image.js";
import { convertData } from "../converters/data.js";
import type { BatchConvertArgs } from "../types/index.js";
import {
  getFamilyConversionError,
  getFileKind,
  normalizeExtension,
} from "./routing.js";
import { buildOutputPath } from "./preview.js";

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

// ── Main export ───────────────────────────────────────────────────────────────

export async function batchConvert(args: BatchConvertArgs): Promise<BatchConvertResult> {
  const { inputPaths, targetExtension, overwrite, preview, width, height, quality } = args;

  const normalizedTargetExt = normalizeExtension(targetExtension);

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

      const conversionError = getFamilyConversionError(sourceExt, normalizedTargetExt);
      if (conversionError) {
        throw new Error(conversionError);
      }

      const outputPath = buildOutputPath(inputPath, sourceExt, normalizedTargetExt, overwrite);

      if (preview) {
        return { inputPath, status: "success", outputPath };
      }

      const inputBuffer = await readFile(inputPath);
      let outputData: Buffer | string;

      if (getFileKind(sourceExt) === "image") {
        outputData = await convertImage(inputBuffer, normalizedTargetExt, { width, height, quality });
      } else {
        outputData = await convertData(inputBuffer, sourceExt, normalizedTargetExt);
      }

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
