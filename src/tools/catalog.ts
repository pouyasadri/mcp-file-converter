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
import {
  formatBatchConversionMessage,
  formatConversionSuccessMessage,
  formatJsonResponse,
} from "./response.js";
import {
  getFamilyConversionError,
  getFileKind,
  getSuggestedTargetExtensions,
  getSuggestedTargetMessage,
  normalizeExtension,
} from "./routing.js";

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CapabilityReport {
  server: {
    name: string;
    version: string;
  };
  policy: {
    type: "family-based";
    families: Array<{
      kind: "image" | "structured" | "markup";
      extensions: readonly string[];
      suggestedTargets: readonly string[];
    }>;
  };
  tools: Array<Pick<ToolDescriptor, "name" | "description">>;
  features: {
    previewMode: boolean;
    batchConversion: boolean;
    suggestions: boolean;
    inspectionSuggestions: boolean;
    provenance: boolean;
  };
}

const toolDescriptors: ToolDescriptor[] = [
  {
    name: "convert_file",
    description:
      "Convert a single file to a compatible target extension. Use preview=true to return the planned output path and suggested targets without writing a file.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: { type: "string", description: "Absolute path to the source file" },
        targetExtension: { type: "string", description: "Target extension e.g. '.webp', '.json', '.toml', '.xml'" },
        overwrite: { type: "boolean", description: "Overwrite original file (default: false = create a copy)" },
        preview: { type: "boolean", description: "Preview the output path without writing a file" },
        width: { type: "integer", description: "Image resize width (image files only)" },
        height: { type: "integer", description: "Image resize height (image files only)" },
        quality: { type: "integer", description: "Image output quality 1–100 (image files only)" },
      },
      required: ["inputPath", "targetExtension"],
    },
  },
  {
    name: "batch_convert_files",
    description:
      "Convert multiple files to the same target format in parallel with per-file success/failure output. Use preview=true to return planned output paths without writing files.",
    inputSchema: {
      type: "object",
      properties: {
        inputPaths: { type: "array", items: { type: "string" }, description: "Array of absolute file paths" },
        targetExtension: { type: "string", description: "Target extension for all files" },
        overwrite: { type: "boolean", description: "Overwrite originals (default: false)" },
        preview: { type: "boolean", description: "Preview output paths without writing files" },
        width: { type: "integer", description: "Image resize width (image files only)" },
        height: { type: "integer", description: "Image resize height (image files only)" },
        quality: { type: "integer", description: "Image quality 1–100 (image files only)" },
      },
      required: ["inputPaths", "targetExtension"],
    },
  },
  {
    name: "inspect_file",
    description:
      "Return metadata about a file without modifying it, including suggested target formats for the detected family.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: { type: "string", description: "Absolute path to the file to inspect" },
      },
      required: ["inputPath"],
    },
  },
  {
    name: "suggest_targets",
    description: "Suggest valid conversion targets for a file family using inputPath or sourceExtension.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: { type: "string", description: "Optional: absolute path to the file to analyze" },
        sourceExtension: { type: "string", description: "Optional: file extension like '.png' or 'json'" },
      },
      oneOf: [{ required: ["inputPath"] }, { required: ["sourceExtension"] }],
    },
  },
  {
    name: "discover_capabilities",
    description:
      "Return the server's supported file families, tools, suggested targets, feature flags, and provenance support.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "extract_pdf",
    description:
      "Extract all text content from a PDF file and return it as plain text. Useful for reading, summarising, or indexing PDF documents.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: { type: "string", description: "Absolute path to the PDF file" },
      },
      required: ["inputPath"],
    },
  },
  {
    name: "compress_file",
    description: "Compress a file using gzip (.gz) or zip (.zip). Returns the path of the compressed output file.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: { type: "string", description: "Absolute path to the file to compress" },
        format: { type: "string", enum: ["gz", "zip"], description: "Compression format: 'gz' or 'zip'" },
      },
      required: ["inputPath", "format"],
    },
  },
  {
    name: "decompress_file",
    description:
      "Decompress a .gz or .zip file. For .zip files, all contained files are extracted to the same directory (or outputDir if specified).",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: { type: "string", description: "Absolute path to the .gz or .zip file" },
        outputDir: { type: "string", description: "Optional: directory to extract into (defaults to same directory as the input)" },
      },
      required: ["inputPath"],
    },
  },
];

type ToolCallContext = {
  arguments?: Record<string, unknown>;
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

function buildCapabilityReport(): CapabilityReport {
  return {
    server: {
      name: "file-converter",
      version: "2.0.0",
    },
    policy: {
      type: "family-based",
      families: [
        {
          kind: "image",
          extensions: [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff"],
          suggestedTargets: getSuggestedTargetExtensions("image"),
        },
        {
          kind: "structured",
          extensions: [".json", ".yaml", ".yml", ".csv", ".xlsx", ".toml", ".xml"],
          suggestedTargets: getSuggestedTargetExtensions("structured"),
        },
        {
          kind: "markup",
          extensions: [".md", ".html"],
          suggestedTargets: getSuggestedTargetExtensions("markup"),
        },
      ],
    },
    tools: toolDescriptors
      .filter((tool) => tool.name !== "discover_capabilities")
      .map((tool) => ({ name: tool.name, description: tool.description })),
    features: {
      previewMode: true,
      batchConversion: true,
      suggestions: true,
      inspectionSuggestions: true,
      provenance: true,
    },
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

const toolHandlers: Record<string, (args: ToolCallContext) => Promise<unknown>> = {
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

export function listTools(): ToolDescriptor[] {
  return toolDescriptors;
}

export function getCapabilityReport(): CapabilityReport {
  return buildCapabilityReport();
}

export async function dispatchTool(toolName: string, args: ToolCallContext): Promise<unknown> {
  const handler = toolHandlers[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return handler(args);
}
