export function formatJsonResponse(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

export function formatConversionSuccessMessage(args: {
  inputPath: string;
  targetExtension: string;
  outputPath: string;
  manifest?: unknown;
}): string {
  return JSON.stringify({
    status: "success",
    message: `Successfully converted ${args.inputPath} to ${args.targetExtension}. Output saved to: ${args.outputPath}`,
    inputPath: args.inputPath,
    targetExtension: args.targetExtension,
    outputPath: args.outputPath,
    manifest: args.manifest,
  }, null, 2);
}

export function formatBatchConversionMessage(result: {
  succeeded: number;
  total: number;
  results: Array<{ inputPath: string; status: "success" | "failed"; outputPath?: string; error?: string }>;
}): string {
  const lines = result.results.map((r) =>
    r.status === "success"
      ? `✅ ${r.inputPath} → ${r.outputPath}`
      : `❌ ${r.inputPath}: ${r.error}`
  );

  return `Batch conversion complete: ${result.succeeded}/${result.total} succeeded.\n\n${lines.join("\n")}`;
}
