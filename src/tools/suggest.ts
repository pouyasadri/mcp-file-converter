import { extname } from "path";
import { getTargetSuggestions } from "./routing.js";
import { inspectFile } from "./inspect.js";

export interface SuggestTargetsResult {
  sourceExtension: string;
  sourceKind: string;
  suggestedTargets: readonly string[];
  message: string;
}

export async function suggestTargets(args: {
  inputPath?: string;
  sourceExtension?: string;
}): Promise<SuggestTargetsResult> {
  let sourceExtension = args.sourceExtension ?? "";

  if (!sourceExtension && args.inputPath) {
    const inspected = await inspectFile(args.inputPath);
    sourceExtension = inspected.format ? `.${inspected.format}` : extname(args.inputPath);
  }

  const result = getTargetSuggestions(sourceExtension);
  return {
    sourceExtension: result.sourceExtension,
    sourceKind: result.sourceKind,
    suggestedTargets: result.suggestedTargets,
    message: result.message,
  };
}
