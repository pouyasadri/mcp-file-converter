import { parse as parseCsv } from "csv-parse/sync";
import YAML from "yaml";
import * as XLSX from "xlsx";
import * as TOML from "smol-toml";
import { XMLParser } from "fast-xml-parser";

export type StructuredData = Record<string, unknown>[] | Record<string, unknown>;

export type StructuredRow = Record<string, unknown>;

function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

export function parseStructuredData(inputBuffer: Buffer, sourceExt: string): StructuredData {
  const ext = normalizeExtension(sourceExt);
  const text = inputBuffer.toString("utf-8");

  if (ext === ".json") {
    return JSON.parse(text) as StructuredData;
  }

  if (ext === ".yaml" || ext === ".yml") {
    return YAML.parse(text) as StructuredData;
  }

  if (ext === ".csv") {
    return parseCsv(text, { columns: true }) as StructuredData;
  }

  if (ext === ".toml") {
    return TOML.parse(text) as StructuredData;
  }

  if (ext === ".xml") {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    return parser.parse(text) as StructuredData;
  }

  if (ext === ".xlsx") {
    const workbook = XLSX.read(inputBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("XLSX file contains no sheets.");
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error("Could not read the first sheet from XLSX file.");
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  }

  throw new Error(`Unsupported structured data extension: ${sourceExt}`);
}

export function extractStructuredRows(inputBuffer: Buffer, sourceExt: string): StructuredRow[] {
  const parsedData = parseStructuredData(inputBuffer, sourceExt);
  return Array.isArray(parsedData) ? parsedData : [parsedData];
}
