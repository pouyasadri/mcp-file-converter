import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, dirname, basename } from "node:path";
import { ConvertFileSchema } from "./types/index.js";
import { convertImage } from "./converters/image.js";
import { convertData } from "./converters/data.js";

const server = new Server(
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
const DATA_EXTENSIONS = [".json", ".yaml", ".yml", ".csv"];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "convert_file",
        description: "Convert a file to another format (Images or Data files like JSON/CSV/YAML)",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Absolute path to the source file" },
            targetExtension: { type: "string", description: "Target extension (e.g., '.jpg', '.png', '.csv', '.json', '.yaml')" },
            overwrite: { type: "boolean", description: "Whether to overwrite the original file or create a copy" },
          },
          required: ["inputPath", "targetExtension"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "convert_file") {
    throw new Error("Unknown tool");
  }

  try {
    const { inputPath, targetExtension, overwrite } = ConvertFileSchema.parse(request.params.arguments);
    const sourceExt = extname(inputPath);
    const normalizedTargetExt = targetExtension.startsWith(".") ? targetExtension : `.${targetExtension}`;
    
    if (sourceExt.toLowerCase() === normalizedTargetExt.toLowerCase()) {
      return {
        content: [{ type: "text", text: "Source and target extensions are the same. No conversion needed." }],
      };
    }

    const inputBuffer = await readFile(inputPath);
    let outputData: Buffer | string;

    const isImage = IMAGE_EXTENSIONS.includes(sourceExt.toLowerCase());
    const isData = DATA_EXTENSIONS.includes(sourceExt.toLowerCase());

    if (isImage) {
      outputData = await convertImage(inputBuffer, normalizedTargetExt);
    } else if (isData) {
      outputData = await convertData(inputBuffer, sourceExt, normalizedTargetExt);
    } else {
      throw new Error(`Unsupported source file type: ${sourceExt}`);
    }

    let outputPath = inputPath;
    const fileName = basename(inputPath, sourceExt);
    
    if (!overwrite || (overwrite && sourceExt !== normalizedTargetExt)) {
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
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
