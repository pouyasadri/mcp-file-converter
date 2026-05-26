import { basename, dirname, join } from "path";

export interface ConversionPreview {
  inputPath: string;
  sourceExtension: string;
  targetExtension: string;
  outputPath: string;
  overwrite: boolean;
}

export function buildOutputPath(inputPath: string, sourceExt: string, targetExt: string, overwrite: boolean): string {
  if (overwrite) return inputPath;
  const fileName = basename(inputPath, sourceExt);
  return join(dirname(inputPath), `${fileName}${targetExt}`);
}

export function buildConversionPreview(
  inputPath: string,
  sourceExt: string,
  targetExt: string,
  overwrite: boolean
): ConversionPreview {
  return {
    inputPath,
    sourceExtension: sourceExt,
    targetExtension: targetExt,
    outputPath: buildOutputPath(inputPath, sourceExt, targetExt, overwrite),
    overwrite,
  };
}
