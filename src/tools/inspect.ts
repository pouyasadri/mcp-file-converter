import sharp from "sharp";
import { parse as parseCsv } from "csv-parse/sync";
import YAML from "yaml";
import * as TOML from "smol-toml";
import * as XLSX from "xlsx";
import { XMLParser } from "fast-xml-parser";
import { readFile } from "fs/promises";
import { extname } from "path";
import { getFileKind, normalizeExtension } from "./routing.js";

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
}

export interface DataMetadata {
  type: "data";
  format: string;
  rowCount: number;
  columns: string[];
  sizeBytes: number;
}

export interface MarkupMetadata {
  type: "markup";
  format: string;
  characterCount: number;
  lineCount: number;
  sizeBytes: number;
}

export type FileMetadata = ImageMetadata | DataMetadata | MarkupMetadata;

// ── Extension sets ────────────────────────────────────────────────────────────

// ── Internal helper: parse text-based data files into row arrays ──────────────

function parseDataRows(content: string, ext: string): Record<string, unknown>[] {
  switch (ext) {
    case ".json": {
      const parsed = JSON.parse(content) as unknown;
      return Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[])
        : [parsed as Record<string, unknown>];
    }
    case ".yaml":
    case ".yml": {
      const data = YAML.parse(content) as unknown;
      return Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : [data as Record<string, unknown>];
    }
    case ".csv":
      return parseCsv(content, { columns: true }) as Record<string, unknown>[];
    case ".toml": {
      const data = TOML.parse(content) as unknown;
      return Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : [data as Record<string, unknown>];
    }
    case ".xml": {
      const parser = new XMLParser({ ignoreAttributes: false });
      const data = parser.parse(content) as unknown;
      return Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : [data as Record<string, unknown>];
    }
    default:
      return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function inspectFile(inputPath: string): Promise<FileMetadata> {
  const inputBuffer = await readFile(inputPath);
  const ext = extname(inputPath).toLowerCase();
  const normalizedExt = normalizeExtension(ext);
  const sizeBytes = inputBuffer.length;

  // ── Image ──────────────────────────────────────────────────────────────────
  if (getFileKind(ext) === "image") {
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
    };
  }

  // ── Markup ─────────────────────────────────────────────────────────────────
  if (getFileKind(ext) === "markup") {
    const text = inputBuffer.toString("utf-8");
    return {
      type: "markup",
      format: normalizedExt.replace(".", ""),
      characterCount: text.length,
      lineCount: text.split("\n").length,
      sizeBytes,
    };
  }

  // ── XLSX (binary) ──────────────────────────────────────────────────────────
  if (normalizedExt === ".xlsx") {
    const wb = XLSX.read(inputBuffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("XLSX file contains no sheets.");
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error("Could not read the first sheet from XLSX file.");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
    return { type: "data", format: "xlsx", rowCount: rows.length, columns, sizeBytes };
  }

  // ── Text-based structured data ─────────────────────────────────────────────
  if (getFileKind(ext) === "structured") {
    const content = inputBuffer.toString("utf-8");
    let rows: Record<string, unknown>[] = [];
    try {
      rows = parseDataRows(content, ext);
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
    };
  }

  throw new Error(`Unsupported file type for inspection: ${ext}`);
}
