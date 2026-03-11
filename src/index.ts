import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, access } from "node:fs/promises";
import { extname, join, dirname, basename } from "node:path";
import { ConvertFileSchema, BatchConvertSchema } from "./types/index.js";
import { convertImage } from "./converters/image.js";
import { convertData } from "./converters/data.js";
import { extractPdfText } from "./tools/pdf.js";
import { inspectFile } from "./tools/inspect.js";
import { compressFile, decompressFile } from "./tools/compress.js";
import { batchConvert } from "./tools/batch.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mcpServer = new McpServer(
  { name: "file-converter", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff"];
const DATA_EXTENSIONS  = [".json", ".yaml", ".yml", ".csv", ".md", ".html", ".xlsx", ".toml", ".xml"];

// ── Tool: list_tools ───────────────────────────────────────────────────────────

mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "convert_file",
      description:
        "Convert a single file to another format. Supports: Images (PNG/JPG/WebP/AVIF/TIFF), " +
        "Data (JSON/YAML/CSV/XLSX/TOML/XML), and Markup (Markdown/HTML). " +
        "Optional image params: width, height, quality.",
      inputSchema: {
        type: "object",
        properties: {
          inputPath:       { type: "string",  description: "Absolute path to the source file" },
          targetExtension: { type: "string",  description: "Target extension e.g. '.webp', '.json', '.toml', '.xml'" },
          overwrite:       { type: "boolean", description: "Overwrite original file (default: false = create a copy)" },
          width:           { type: "integer", description: "Image resize width (image files only)" },
          height:          { type: "integer", description: "Image resize height (image files only)" },
          quality:         { type: "integer", description: "Image output quality 1–100 (image files only)" },
        },
        required: ["inputPath", "targetExtension"],
      },
    },
    {
      name: "batch_convert_files",
      description:
        "Convert multiple files to the same target format in parallel. " +
        "Returns a per-file success/failure report.",
      inputSchema: {
        type: "object",
        properties: {
          inputPaths:      { type: "array", items: { type: "string" }, description: "Array of absolute file paths" },
          targetExtension: { type: "string",  description: "Target extension for all files" },
          overwrite:       { type: "boolean", description: "Overwrite originals (default: false)" },
          width:           { type: "integer", description: "Image resize width (image files only)" },
          height:          { type: "integer", description: "Image resize height (image files only)" },
          quality:         { type: "integer", description: "Image quality 1–100 (image files only)" },
        },
        required: ["inputPaths", "targetExtension"],
      },
    },
    {
      name: "inspect_file",
      description:
        "Return metadata about a file without modifying it. " +
        "Images: format, dimensions, color space. Data files: row count, column names. " +
        "Markup files: character count, line count.",
      inputSchema: {
        type: "object",
        properties: {
          inputPath: { type: "string", description: "Absolute path to the file to inspect" },
        },
        required: ["inputPath"],
      },
    },
    {
      name: "extract_pdf",
      description:
        "Extract all text content from a PDF file and return it as plain text. " +
        "Useful for reading, summarising, or indexing PDF documents.",
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
      description:
        "Compress a file using gzip (.gz) or zip (.zip). " +
        "Returns the path of the compressed output file.",
      inputSchema: {
        type: "object",
        properties: {
          inputPath: { type: "string", description: "Absolute path to the file to compress" },
          format:    { type: "string", enum: ["gz", "zip"], description: "Compression format: 'gz' or 'zip'" },
        },
        required: ["inputPath", "format"],
      },
    },
    {
      name: "decompress_file",
      description:
        "Decompress a .gz or .zip file. " +
        "For .zip files, all contained files are extracted to the same directory (or outputDir if specified).",
      inputSchema: {
        type: "object",
        properties: {
          inputPath: { type: "string", description: "Absolute path to the .gz or .zip file" },
          outputDir: { type: "string", description: "Optional: directory to extract into (defaults to same directory as the input)" },
        },
        required: ["inputPath"],
      },
    },
  ],
}));

// ── Tool: call_tool ────────────────────────────────────────────────────────────

mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  // Helper: verify a file exists before doing anything with it
  async function assertFileExists(p: string): Promise<void> {
    try { await access(p); }
    catch { throw new Error(`Source file not found: ${p}`); }
  }

  // ── inspect_file ─────────────────────────────────────────────────────────────
  if (toolName === "inspect_file") {
    try {
      const inputPath = String(request.params.arguments?.inputPath ?? "");
      if (!inputPath) throw new Error("inputPath is required.");
      await assertFileExists(inputPath);
      const metadata = await inspectFile(inputPath);
      return { content: [{ type: "text", text: JSON.stringify(metadata, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error inspecting file: ${error.message}` }], isError: true };
    }
  }

  // ── extract_pdf ──────────────────────────────────────────────────────────────
  if (toolName === "extract_pdf") {
    try {
      const inputPath = String(request.params.arguments?.inputPath ?? "");
      if (!inputPath) throw new Error("inputPath is required.");
      await assertFileExists(inputPath);
      const inputBuffer = await readFile(inputPath);
      const text = await extractPdfText(inputBuffer);
      return { content: [{ type: "text", text }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error extracting PDF: ${error.message}` }], isError: true };
    }
  }

  // ── compress_file ────────────────────────────────────────────────────────────
  if (toolName === "compress_file") {
    try {
      const inputPath = String(request.params.arguments?.inputPath ?? "");
      const format    = String(request.params.arguments?.format ?? "") as "gz" | "zip";
      if (!inputPath) throw new Error("inputPath is required.");
      if (format !== "gz" && format !== "zip") throw new Error("format must be 'gz' or 'zip'.");
      await assertFileExists(inputPath);
      const result = await compressFile(inputPath, format);
      return {
        content: [{
          type: "text",
          text: `Compressed successfully.\nOutput: ${result.outputPath}\nOriginal: ${result.originalSizeBytes} bytes → Compressed: ${result.compressedSizeBytes} bytes`,
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error compressing file: ${error.message}` }], isError: true };
    }
  }

  // ── decompress_file ──────────────────────────────────────────────────────────
  if (toolName === "decompress_file") {
    try {
      const inputPath = String(request.params.arguments?.inputPath ?? "");
      const outputDir = request.params.arguments?.outputDir
        ? String(request.params.arguments.outputDir)
        : undefined;
      if (!inputPath) throw new Error("inputPath is required.");
      await assertFileExists(inputPath);
      const result = await decompressFile(inputPath, outputDir);
      return {
        content: [{
          type: "text",
          text: `Decompressed successfully.\nOutput directory: ${result.outputPath}\nExtracted files:\n${result.extractedFiles.join("\n")}`,
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error decompressing file: ${error.message}` }], isError: true };
    }
  }

  // ── batch_convert_files ──────────────────────────────────────────────────────
  if (toolName === "batch_convert_files") {
    try {
      const args = BatchConvertSchema.parse(request.params.arguments);
      const result = await batchConvert(args);
      const lines = result.results.map((r) =>
        r.status === "success"
          ? `✅ ${r.inputPath} → ${r.outputPath}`
          : `❌ ${r.inputPath}: ${r.error}`
      );
      return {
        content: [{
          type: "text",
          text: `Batch conversion complete: ${result.succeeded}/${result.total} succeeded.\n\n${lines.join("\n")}`,
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error during batch conversion: ${error.message}` }], isError: true };
    }
  }

  // ── convert_file ─────────────────────────────────────────────────────────────
  if (toolName === "convert_file") {
    try {
      const { inputPath, targetExtension, overwrite, width, height, quality } =
        ConvertFileSchema.parse(request.params.arguments);

      const sourceExt = extname(inputPath);
      const normalizedTargetExt = targetExtension.startsWith(".")
        ? targetExtension
        : `.${targetExtension}`;

      if (sourceExt.toLowerCase() === normalizedTargetExt.toLowerCase()) {
        return { content: [{ type: "text", text: "Source and target extensions are the same. No conversion needed." }] };
      }

      await assertFileExists(inputPath);
      const inputBuffer = await readFile(inputPath);

      const isImageSrc = IMAGE_EXTENSIONS.includes(sourceExt.toLowerCase());
      const isDataSrc  = DATA_EXTENSIONS.includes(sourceExt.toLowerCase());
      const isImageTgt = IMAGE_EXTENSIONS.includes(normalizedTargetExt.toLowerCase());
      const isDataTgt  = DATA_EXTENSIONS.includes(normalizedTargetExt.toLowerCase());

      if (isImageSrc && !isImageTgt) {
        throw new Error(
          `Cannot convert an image (${sourceExt}) to a data format (${normalizedTargetExt}). ` +
          `Target must be one of: ${IMAGE_EXTENSIONS.join(", ")}.`
        );
      }
      if (isDataSrc && !isDataTgt) {
        throw new Error(
          `Cannot convert a data file (${sourceExt}) to an image format (${normalizedTargetExt}). ` +
          `Target must be one of: ${DATA_EXTENSIONS.join(", ")}.`
        );
      }

      let outputData: Buffer | string;
      if (isImageSrc) {
        outputData = await convertImage(inputBuffer, normalizedTargetExt, { width, height, quality });
      } else if (isDataSrc) {
        outputData = await convertData(inputBuffer, sourceExt, normalizedTargetExt);
      } else {
        throw new Error(`Unsupported source file type: ${sourceExt}`);
      }

      const fileName = basename(inputPath, sourceExt);
      const outputPath = overwrite
        ? inputPath
        : join(dirname(inputPath), `${fileName}${normalizedTargetExt}`);

      await writeFile(outputPath, outputData);

      return {
        content: [{
          type: "text",
          text: `Successfully converted ${inputPath} to ${normalizedTargetExt}. Output saved to: ${outputPath}`,
        }],
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error during conversion: ${error.message}` }], isError: true };
    }
  }

  throw new Error(`Unknown tool: ${toolName}`);
});

// ── Server startup ──────────────────────────────────────────────────────────────

async function runServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
