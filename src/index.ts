import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, access } from "fs/promises";
import { extname } from "path";
import { ConvertFileSchema, BatchConvertSchema } from "./types/index.js";
import { convertImage } from "./converters/image.js";
import { convertData } from "./converters/data.js";
import { extractPdfText } from "./tools/pdf.js";
import { inspectFile } from "./tools/inspect.js";
import { compressFile, decompressFile } from "./tools/compress.js";
import { batchConvert } from "./tools/batch.js";
import { buildConversionPreview, buildOutputPath } from "./tools/preview.js";
import {
  getFamilyConversionError,
  getFileKind,
  getSuggestedTargetMessage,
  normalizeExtension,
} from "./tools/routing.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mcpServer = new McpServer(
  { name: "file-converter", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool: list_tools ───────────────────────────────────────────────────────────

mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "convert_file",
      description:
        "Convert a single file to another format. Supports: Images (PNG/JPG/WebP/AVIF/TIFF), " +
        "Data (JSON/YAML/CSV/XLSX/TOML/XML), and Markup (Markdown/HTML). " +
        "Optional image params: width, height, quality. " +
        "Use preview=true to return the planned output path and suggested targets without writing a file.",
      inputSchema: {
        type: "object",
        properties: {
          inputPath:       { type: "string",  description: "Absolute path to the source file" },
          targetExtension: { type: "string",  description: "Target extension e.g. '.webp', '.json', '.toml', '.xml'" },
          overwrite:       { type: "boolean", description: "Overwrite original file (default: false = create a copy)" },
          preview:         { type: "boolean", description: "Preview the output path without writing a file" },
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
        "Returns a per-file success/failure report. " +
        "Use preview=true to return planned output paths without writing files.",
      inputSchema: {
        type: "object",
        properties: {
          inputPaths:      { type: "array", items: { type: "string" }, description: "Array of absolute file paths" },
          targetExtension: { type: "string",  description: "Target extension for all files" },
          overwrite:       { type: "boolean", description: "Overwrite originals (default: false)" },
          preview:         { type: "boolean", description: "Preview output paths without writing files" },
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
        "Markup files: character count, line count. " +
        "Includes suggested target formats for the detected file family.",
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
      const { inputPath, targetExtension, overwrite, preview, width, height, quality } =
        ConvertFileSchema.parse(request.params.arguments);

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

      const outputPath = buildOutputPath(inputPath, sourceExt, normalizedTargetExt, overwrite);

      if (preview) {
        const conversionPreview = buildConversionPreview(
          inputPath,
          sourceExt,
          normalizedTargetExt,
          overwrite
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify(conversionPreview, null, 2),
          }],
        };
      }

      const inputBuffer = await readFile(inputPath);

      let outputData: Buffer | string;
      if (getFileKind(sourceExt) === "image") {
        outputData = await convertImage(inputBuffer, normalizedTargetExt, { width, height, quality });
      } else {
        outputData = await convertData(inputBuffer, sourceExt, normalizedTargetExt);
      }

      await writeFile(outputPath, outputData);

      return {
        content: [{
          type: "text",
          text: `Successfully converted ${inputPath} to ${normalizedTargetExt}. Output saved to: ${outputPath}`,
        }],
      };
    } catch (error: any) {
      const sourceExt = extname(String(request.params.arguments?.inputPath ?? "")).toLowerCase();
      const suggestion = sourceExt ? ` ${getSuggestedTargetMessage(sourceExt)}` : "";
      return { content: [{ type: "text", text: `Error during conversion: ${error.message}.${suggestion}` }], isError: true };
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
