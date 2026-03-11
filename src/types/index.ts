import { z } from "zod";

export const ConvertFileSchema = z.object({
  inputPath: z.string().describe("Absolute path to the source file"),
  targetExtension: z.string().describe("Target extension (e.g., '.jpg', '.png', '.csv', '.json', '.yaml', '.toml', '.xml')"),
  overwrite: z.boolean().optional().default(false).describe("Whether to overwrite the original file or create a copy"),
  width: z.number().int().optional().describe("Optional: Resize image width (Image files only)"),
  height: z.number().int().optional().describe("Optional: Resize image height (Image files only)"),
  quality: z.number().int().min(1).max(100).optional().describe("Optional: Compress image output 1-100 (Image files only)"),
});

export type ConvertFileArgs = z.infer<typeof ConvertFileSchema>;

// Schema for the batch_convert_files tool
export const BatchConvertSchema = z.object({
  inputPaths: z.array(z.string()).min(1).describe("Array of absolute paths to source files"),
  targetExtension: z.string().describe("Target extension for all files (e.g., '.webp', '.json')"),
  overwrite: z.boolean().optional().default(false).describe("Whether to overwrite originals or create copies"),
  width: z.number().int().optional().describe("Optional: Image width resize (Image files only)"),
  height: z.number().int().optional().describe("Optional: Image height resize (Image files only)"),
  quality: z.number().int().min(1).max(100).optional().describe("Optional: Image quality 1-100 (Image files only)"),
});

export type BatchConvertArgs = z.infer<typeof BatchConvertSchema>;
