import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import YAML from "yaml";

type DataParser = (content: string) => any;
type DataStringifier = (data: any) => string;

const parsers: Record<string, DataParser> = {
  ".json": (content) => JSON.parse(content),
  ".yaml": (content) => YAML.parse(content),
  ".yml": (content) => YAML.parse(content),
  ".csv": (content) => parseCsv(content, { columns: true }),
};

const stringifiers: Record<string, DataStringifier> = {
  ".json": (data) => JSON.stringify(data, null, 2),
  ".yaml": (data) => YAML.stringify(data),
  ".yml": (data) => YAML.stringify(data),
  ".csv": (data) => {
    // CSV stringifier expects an array of objects
    const arrayData = Array.isArray(data) ? data : [data];
    return stringifyCsv(arrayData, { header: true });
  }
};

export async function convertData(inputBuffer: Buffer, sourceExt: string, targetExt: string): Promise<string> {
  const content = inputBuffer.toString("utf-8");
  let parsedData: any;

  // 1. Parsing Phase
  const parser = parsers[sourceExt.toLowerCase()];
  if (!parser) {
    throw new Error(`Unsupported source data extension: ${sourceExt}`);
  }

  try {
    parsedData = parser(content);
  } catch (error: any) {
    throw new Error(`Failed to parse ${sourceExt} file: ${error.message}`);
  }

  // 2. Stringifying Phase
  const stringifier = stringifiers[targetExt.toLowerCase()];
  if (!stringifier) {
    throw new Error(`Unsupported target data extension: ${targetExt}`);
  }

  try {
    return stringifier(parsedData);
  } catch (error: any) {
    throw new Error(`Failed to generate ${targetExt} output: ${error.message}`);
  }
}
