import { stringify as stringifyCsv } from "csv-stringify/sync";
import YAML from "yaml";
import { marked } from "marked";
import TurndownService from "turndown";
import * as XLSX from "xlsx";
import * as TOML from "smol-toml";
import { XMLBuilder } from "fast-xml-parser";
import { parseStructuredData, type StructuredData } from "../structured.js";

// Stringifiers produce either a UTF-8 string or a binary Buffer (e.g. XLSX)
type DataStringifier = (data: StructuredData | string) => Buffer | string;

const turndown = new TurndownService({ headingStyle: "atx" });

const stringifiers: Record<string, DataStringifier> = {
  ".json": (data) => JSON.stringify(data, null, 2),
  ".yaml": (data) => YAML.stringify(data),
  ".yml": (data) => YAML.stringify(data),
  ".csv": (data) => {
    // CSV stringifier expects an array of objects
    const arrayData = Array.isArray(data) ? data : [data as Record<string, unknown>];
    return stringifyCsv(arrayData, { header: true });
  },
  // Markup conversions
  ".html": (data) => marked(data as string) as string,
  ".md": (data) => turndown.turndown(data as string),
  // XLSX output is binary — return a Buffer
  ".xlsx": (data) => {
    const arrayData = Array.isArray(data) ? data : [data as Record<string, unknown>];
    const ws = XLSX.utils.json_to_sheet(arrayData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array);
  },
  // TOML output
  ".toml": (data) => TOML.stringify(data as Record<string, unknown>),
  // XML output
  ".xml": (data) => {
    const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_", format: true });
    // Wrap arrays in a root element since XML requires a single root
    const payload = Array.isArray(data) ? { items: { item: data } } : data;
    return builder.build(payload) as string;
  },
};

export async function convertData(
  inputBuffer: Buffer,
  sourceExt: string,
  targetExt: string
): Promise<Buffer | string> {
  const srcExt = sourceExt.toLowerCase();
  const tgtExt = targetExt.toLowerCase();

  const structuredExtensions = new Set([".json", ".yaml", ".yml", ".csv", ".xlsx", ".toml", ".xml"]);
  const markupExtensions = new Set([".md", ".html"]);

  // 1. Parsing Phase
  if (!structuredExtensions.has(srcExt) && !markupExtensions.has(srcExt)) {
    throw new Error(`Unsupported source data extension: ${sourceExt}`);
  }

  let parsedData: StructuredData | string;

  try {
    if (structuredExtensions.has(srcExt)) {
      parsedData = parseStructuredData(inputBuffer, srcExt);
    } else {
      parsedData = inputBuffer.toString("utf-8");
    }
  } catch (error: any) {
    throw new Error(`Failed to parse ${sourceExt} file: ${error.message}`);
  }

  // 2. Stringifying Phase
  const stringifier = stringifiers[tgtExt];
  if (!stringifier) {
    throw new Error(`Unsupported target data extension: ${targetExt}`);
  }

  try {
    return stringifier(parsedData);
  } catch (error: any) {
    throw new Error(`Failed to generate ${targetExt} output: ${error.message}`);
  }
}
