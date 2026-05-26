import { access, readFile, writeFile } from "fs/promises";
import { extname } from "path";
import { ConvertFileSchema, BatchConvertSchema } from "../types/index.js";
import { convertImage } from "../converters/image.js";
import { convertData } from "../converters/data.js";
import { extractPdfText } from "./pdf.js";
import { inspectFile } from "./inspect.js";
import { compressFile, decompressFile } from "./compress.js";
import { batchConvert } from "./batch.js";
import { buildConversionPreview, buildOutputPath } from "./preview.js";
import { suggestTargets } from "./suggest.js";
import { buildConversionManifest } from "./provenance.js";
import { formatBatchConversionMessage, formatConversionSuccessMessage, formatJsonResponse } from "./response.js";
import { getFamilyConversionError, getFileKind, normalizeExtension } from "./routing.js";

type ToolCallContext = {
  arguments?: Record<string, unknown>;
};

type CapabilityReport = {
  server: { name: string; version: string };
  policy: {
    type: "family-based";
    families: Array<{ kind: "image" | "structured" | "markup"; extensions: readonly string[]; suggestedTargets: readonly string[] }>;
  };
  tools: Array<{ name: string; description: string }>;
  features: {
    previewMode: boolean;
    batchConversion: boolean;
    suggestions: boolean;
    inspectionSuggestions: boolean;
    provenance: boolean;
  };
};

function assertString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(message);
  }
  return value;
}

async function assertFileExists(inputPath: string): Promise<void> {
  try {
    await access(inputPath);
  } catch {
    throw new Error(`Source file not found: ${inputPath}`);
  }
}

function getRequestString(args: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = args?.[key];
  return typeof value === "string" ? value : undefined;
}

export function createToolHandlers(buildCapabilityReport: () => CapabilityReport): Record<string, (args: ToolCallContext) => Promise<unknown>> {
  async function handleInspectFile(args: ToolCallContext): Promise<unknown> {
    const inputPath = assertString(args.arguments?.inputPath, "inputPath is required.");
    await assertFileExists(inputPath);
    const metadata = await inspectFile(inputPath);
    return { content: [{ type: "text", text: formatJsonResponse(metadata) }] };
  }

  async function handleSuggestTargets(args: ToolCallContext): Promise<unknown> {
    const inputPath = getRequestString(args.arguments, "inputPath");
    const sourceExtension = getRequestString(args.arguments, "sourceExtension");

    if (!inputPath && !sourceExtension) {
      throw new Error("Provide inputPath or sourceExtension.");
    }

    if (inputPath) {
      await assertFileExists(inputPath);
    }

    const result = await suggestTargets({ inputPath, sourceExtension });
    return { content: [{ type: "text", text: formatJsonResponse(result) }] };
  }

  async function handleExtractPdf(args: ToolCallContext): Promise<unknown> {
    const inputPath = assertString(args.arguments?.inputPath, "inputPath is required.");
    await assertFileExists(inputPath);
    const inputBuffer = await readFile(inputPath);
    const text = await extractPdfText(inputBuffer);
    return { content: [{ type: "text", text }] };
  }

  async function handleCompressFile(args: ToolCallContext): Promise<unknown> {
    const inputPath = assertString(args.arguments?.inputPath, "inputPath is required.");
    const format = assertString(args.arguments?.format, "format is required.") as "gz" | "zip";

    if (format !== "gz" && format !== "zip") {
      throw new Error("format must be 'gz' or 'zip'.");
    }

    await assertFileExists(inputPath);
    const result = await compressFile(inputPath, format);
    return {
      content: [{
        type: "text",
        text: `Compressed successfully.\nOutput: ${result.outputPath}\nOriginal: ${result.originalSizeBytes} bytes → Compressed: ${result.compressedSizeBytes} bytes`,
      }],
    };
  }

  async function handleDecompressFile(args: ToolCallContext): Promise<unknown> {
    const inputPath = assertString(args.arguments?.inputPath, "inputPath is required.");
    const outputDir = getRequestString(args.arguments, "outputDir") ?? undefined;
    await assertFileExists(inputPath);
    const result = await decompressFile(inputPath, outputDir);
    return {
      content: [{
        type: "text",
        text: `Decompressed successfully.\nOutput directory: ${result.outputPath}\nExtracted files:\n${result.extractedFiles.join("\n")}`,
      }],
    };
  }

  async function handleBatchConvertFiles(args: ToolCallContext): Promise<unknown> {
    const parsed = BatchConvertSchema.parse(args.arguments);
    const result = await batchConvert(parsed);
    return {
      content: [{
        type: "text",
        text: formatBatchConversionMessage(result),
      }],
    };
  }

  async function handleConvertFile(args: ToolCallContext): Promise<unknown> {
    const { inputPath, targetExtension, overwrite, preview, width, height, quality } = ConvertFileSchema.parse(args.arguments);

    const sourceExt = extname(inputPath);
    const normalizedTargetExt = normalizeExtension(targetExtension);

    if (sourceExt.toLowerCase() === normalizedTargetExt.toLowerCase()) {
      return { content: [{ type: "text", text: "Source and target extensions are the same. No conversion needed." }] };
    }

    await assertFileExists(inputPath);

    const conversionError = getFamilyConversionError(sourceExt, normalizedTargetExt);
    if (conversionError) {
      throw new Error(conversionError);
    }

    const outputPath = buildOutputPath(inputPath, sourceExt, normalizedTargetExt, overwrite ?? false);

    if (preview) {
      const conversionPreview = buildConversionPreview(inputPath, sourceExt, normalizedTargetExt, overwrite ?? false);
      return { content: [{ type: "text", text: formatJsonResponse(conversionPreview) }] };
    }

    const inputBuffer = await readFile(inputPath);

    let outputData: Buffer | string;
    if (getFileKind(sourceExt) === "image") {
      outputData = await convertImage(inputBuffer, normalizedTargetExt, { width, height, quality });
    } else {
      outputData = await convertData(inputBuffer, sourceExt, normalizedTargetExt);
    }

    await writeFile(outputPath, outputData);

    const manifest = await buildConversionManifest({ inputPath, outputPath });

    return {
      content: [{
        type: "text",
        text: formatConversionSuccessMessage({
          inputPath,
          targetExtension: normalizedTargetExt,
          outputPath,
          manifest,
        }),
      }],
    };
  }

  return {
    convert_file: handleConvertFile,
    batch_convert_files: handleBatchConvertFiles,
    inspect_file: handleInspectFile,
    suggest_targets: handleSuggestTargets,
    discover_capabilities: async () => ({
      content: [{ type: "text", text: formatJsonResponse(buildCapabilityReport()) }],
    }),
    extract_pdf: handleExtractPdf,
    compress_file: handleCompressFile,
    decompress_file: handleDecompressFile,
  };
}
