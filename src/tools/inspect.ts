import sharp from "sharp";
import { readFile } from "fs/promises";
import { extname } from "path";
import {
  getFileKind,
  getSuggestedTargetExtensions,
  normalizeExtension,
} from "./routing.js";
import { extractStructuredRows } from "../structured.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImageMetadata {
  type: "image";
  format: string | undefined;
  width: number | undefined;
  height: number | undefined;
  channels: number | undefined;
  colorSpace: string | undefined;
  hasAlpha: boolean | undefined;
  sizeBytes: number;
  suggestedTargets: readonly string[];
}

export interface DataMetadata {
  type: "data";
  format: string;
  rowCount: number;
  columns: string[];
  sizeBytes: number;
  suggestedTargets: readonly string[];
}

export interface MarkupMetadata {
  type: "markup";
  format: string;
  characterCount: number;
  lineCount: number;
  sizeBytes: number;
  suggestedTargets: readonly string[];
}

export type FileMetadata = ImageMetadata | DataMetadata | MarkupMetadata;

// ── Extension sets ────────────────────────────────────────────────────────────

// ── Main export ───────────────────────────────────────────────────────────────

export async function inspectFile(inputPath: string): Promise<FileMetadata> {
  const inputBuffer = await readFile(inputPath);
  const ext = extname(inputPath).toLowerCase();
  const normalizedExt = normalizeExtension(ext);
  const fileKind = getFileKind(ext);
  const sizeBytes = inputBuffer.length;

  switch (fileKind) {
    case "image": {
      const meta = await sharp(inputBuffer).metadata();
      return {
        type: "image",
        format: meta.format,
        width: meta.width,
        height: meta.height,
        channels: meta.channels,
        colorSpace: meta.space,
        hasAlpha: meta.hasAlpha,
        sizeBytes,
        suggestedTargets: getSuggestedTargetExtensions("image"),
      };
    }

    case "markup": {
      const text = inputBuffer.toString("utf-8");
      return {
        type: "markup",
        format: normalizedExt.replace(".", ""),
        characterCount: text.length,
        lineCount: text.split("\n").length,
        sizeBytes,
        suggestedTargets: getSuggestedTargetExtensions("markup"),
      };
    }

    case "structured": {
      let rows: Record<string, unknown>[] = [];
      try {
        rows = extractStructuredRows(inputBuffer, ext);
      } catch {
        // Return minimal metadata if parsing fails — the file exists but may be malformed
      }
      const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
      return {
        type: "data",
        format: normalizedExt.replace(".", ""),
        rowCount: rows.length,
        columns,
        sizeBytes,
        suggestedTargets: getSuggestedTargetExtensions("structured"),
      };
    }

    default:
      break;
  }

  throw new Error(`Unsupported file type for inspection: ${ext}`);
}
