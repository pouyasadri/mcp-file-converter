import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, access } from "node:fs/promises";
import { extname, join, dirname, basename } from "node:path";
import { ConvertFileSchema } from "./types/index.js";
import { convertImage } from "./converters/image.js";
import { convertData } from "./converters/data.js";
import { extractPdfText } from "./tools/pdf";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mcpServer = new McpServer(
  {
    name: "file-converter",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff"];
const DATA_EXTENSIONS = [".json", ".yaml", ".yml", ".csv", ".md", ".html", ".xlsx"];

mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "convert_file",
        description:
          "Convert a file to another format. Supports Images (PNG/JPG/WebP/AVIF/TIFF), " +
          "Data files (JSON/YAML/CSV/XLSX), and Markup files (Markdown/HTML). " +
          "Optional image parameters: width, height, quality.",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Absolute path to the source file" },
            targetExtension: { type: "string", description: "Target extension (e.g., '.jpg', '.png', '.csv', '.json', '.yaml', '.md', '.html', '.xlsx')" },
            overwrite: { type: "boolean", description: "Whether to overwrite the original file or create a copy" },
            width: { type: "integer", description: "Optional image width resize boundary" },
            height: { type: "integer", description: "Optional image height resize boundary" },
            quality: { type: "integer", description: "Optional image output quality (1-100)" },
          },
          required: ["inputPath", "targetExtension"],
        },
      },
      {
        name: "extract_pdf",
        description:
          "Extract all text content from a PDF file and return it as a plain string. " +
          "Useful for reading, summarising, or indexing PDF documents.",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Absolute path to the PDF file" },
          },
          required: ["inputPath"],
        },
      },
    ],
  };
});

mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  // ── extract_pdf ────────────────────────────────────────────────────────────
  if (toolName === "extract_pdf") {
    try {
      const inputPath = String(request.params.arguments?.inputPath ?? "");
      if (!inputPath) throw new Error("inputPath is required.");

      // Verify source file exists
      try {
        await access(inputPath);
      } catch {
        throw new Error(`Source file not found: ${inputPath}`);
      }

      const inputBuffer = await readFile(inputPath);
      const text = await extractPdfText(inputBuffer);

      return {
        content: [{ type: "text", text }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error extracting PDF: ${error.message}` }],
        isError: true,
      };
    }
  }

  // ── convert_file ───────────────────────────────────────────────────────────
  if (toolName === "convert_file") {
    try {
      const { inputPath, targetExtension, overwrite, width, height, quality } =
        ConvertFileSchema.parse(request.params.arguments);

      const sourceExt = extname(inputPath);
      const normalizedTargetExt = targetExtension.startsWith(".")
        ? targetExtension
        : `.${targetExtension}`;

      if (sourceExt.toLowerCase() === normalizedTargetExt.toLowerCase()) {
        return {
          content: [{ type: "text", text: "Source and target extensions are the same. No conversion needed." }],
        };
      }

      // Verify source file exists before attempting to read it
      try {
        await access(inputPath);
      } catch {
        throw new Error(`Source file not found: ${inputPath}`);
      }

      const inputBuffer = await readFile(inputPath);

      const isImageSrc = IMAGE_EXTENSIONS.includes(sourceExt.toLowerCase());
      const isDataSrc = DATA_EXTENSIONS.includes(sourceExt.toLowerCase());
      const isImageTgt = IMAGE_EXTENSIONS.includes(normalizedTargetExt.toLowerCase());
      const isDataTgt = DATA_EXTENSIONS.includes(normalizedTargetExt.toLowerCase());

      // Guard against cross-domain conversions (e.g. image → CSV or JSON → PNG)
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

      let outputPath = inputPath;
      const fileName = basename(inputPath, sourceExt);

      if (!overwrite) {
        outputPath = join(dirname(inputPath), `${fileName}${normalizedTargetExt}`);
      }

      await writeFile(outputPath, outputData);

      return {
        content: [
          {
            type: "text",
            text: `Successfully converted ${inputPath} to ${normalizedTargetExt}. Output saved to: ${outputPath}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error during conversion: ${error.message}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${toolName}`);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});


