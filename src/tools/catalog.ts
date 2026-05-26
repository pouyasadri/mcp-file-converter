import { getSuggestedTargetExtensions } from "./routing.js";
import { createToolHandlers } from "./handlers.js";

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

type ToolCallContext = {
  arguments?: Record<string, unknown>;
};

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
    tools: toolDescriptors.filter((tool) => tool.name !== "discover_capabilities").map((tool) => ({ name: tool.name, description: tool.description })),
    features: {
      previewMode: true,
      batchConversion: true,
      suggestions: true,
      inspectionSuggestions: true,
      provenance: true,
    },
  };
}

const toolHandlers = createToolHandlers(buildCapabilityReport);

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
