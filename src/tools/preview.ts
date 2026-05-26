import { basename, dirname, join } from "path";
import {
  getFileKind,
  getSuggestedTargetExtensions,
  type FileKind,
} from "./routing.js";

export interface ConversionPreview {
  inputPath: string;
  sourceExtension: string;
  sourceKind: Exclude<FileKind, "unsupported"> | "unsupported";
  targetExtension: string;
  targetKind: Exclude<FileKind, "unsupported"> | "unsupported";
  outputPath: string;
  overwrite: boolean;
  suggestedTargets: readonly string[];
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
  const sourceKind = getFileKind(sourceExt);
  const targetKind = getFileKind(targetExt);
  const suggestedTargets = sourceKind === "unsupported"
    ? []
    : getSuggestedTargetExtensions(sourceKind);

  return {
    inputPath,
    sourceExtension: sourceExt,
    sourceKind,
    targetExtension: targetExt,
    targetKind,
    outputPath: buildOutputPath(inputPath, sourceExt, targetExt, overwrite),
    overwrite,
    suggestedTargets,
  };
}
