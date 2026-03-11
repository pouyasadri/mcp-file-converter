import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import YAML from "yaml";
import { marked } from "marked";
import TurndownService from "turndown";
import * as XLSX from "xlsx";
import * as TOML from "smol-toml";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

// Canonical type for parsed structured data across all supported formats
type ParsedData = Record<string, unknown>[] | Record<string, unknown>;

// Parsers return ParsedData for structured formats, or a raw string for markup formats (MD/HTML)
type DataParser = (content: string | Buffer) => ParsedData | string;

// Stringifiers produce either a UTF-8 string or a binary Buffer (e.g. XLSX)
type DataStringifier = (data: ParsedData | string) => Buffer | string;

const parsers: Record<string, DataParser> = {
  ".json": (content) => JSON.parse(content as string) as ParsedData,
  ".yaml": (content) => YAML.parse(content as string) as ParsedData,
  ".yml": (content) => YAML.parse(content as string) as ParsedData,
  ".csv": (content) => parseCsv(content as string, { columns: true }) as ParsedData,
  // Markup formats — raw string pass-through; conversion happens in the stringifier
  ".md": (content) => content as string,
  ".html": (content) => content as string,
  // XLSX is binary: parse from buffer to JSON rows
  ".xlsx": (_content, buffer?: Buffer) => {
    const wb = XLSX.read(buffer ?? Buffer.from(_content as string, "binary"), { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("XLSX file contains no sheets.");
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error("Could not read the first sheet from XLSX file.");
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  },
  // TOML — human-readable config format popular in Rust/Python ecosystems
  ".toml": (content) => TOML.parse(content as string) as ParsedData,
  // XML — parsed to a JS object; ignoreAttributes=false preserves XML attributes
  ".xml": (content) => {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    return parser.parse(content as string) as ParsedData;
  },
};

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

  // 1. Parsing Phase
  const parser = parsers[srcExt];
  if (!parser) {
    throw new Error(`Unsupported source data extension: ${sourceExt}`);
  }

  let parsedData: ParsedData | string;

  try {
    // XLSX parser requires the raw buffer; all others use the UTF-8 string
    if (srcExt === ".xlsx") {
      parsedData = (parsers[".xlsx"] as (c: string, b: Buffer) => ParsedData)("", inputBuffer);
    } else {
      parsedData = parser(inputBuffer.toString("utf-8"));
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
