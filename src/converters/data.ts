import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import YAML from "yaml";

export async function convertData(inputBuffer: Buffer, sourceExt: string, targetExt: string): Promise<string> {
  const content = inputBuffer.toString("utf-8");
  let data: any;

  // Parse source
  switch (sourceExt.toLowerCase()) {
    case ".json":
      data = JSON.parse(content);
      break;
    case ".yaml":
    case ".yml":
      data = YAML.parse(content);
      break;
    case ".csv":
      data = parseCsv(content, { columns: true });
      break;
    default:
      throw new Error(`Unsupported source data extension: ${sourceExt}`);
  }

  // Stringify to target
  switch (targetExt.toLowerCase()) {
    case ".json":
      return JSON.stringify(data, null, 2);
    case ".yaml":
    case ".yml":
      return YAML.stringify(data);
    case ".csv":
      return stringifyCsv(data, { header: true });
    default:
      throw new Error(`Unsupported target data extension: ${targetExt}`);
  }
}
