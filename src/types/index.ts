import { z } from "zod";

export const ConvertFileSchema = z.object({
  inputPath: z.string().describe("Absolute path to the source file"),
  targetExtension: z.string().describe("Target extension (e.g., '.jpg', '.png', '.csv', '.json', '.yaml')"),
  overwrite: z.boolean().optional().default(false).describe("Whether to overwrite the original file or create a copy"),
  width: z.number().int().optional().describe("Optional: Resize image width (Image files only)"),
  height: z.number().int().optional().describe("Optional: Resize image height (Image files only)"),
  quality: z.number().int().min(1).max(100).optional().describe("Optional: Compress image output 1-100 (Image files only)"),
});

export type ConvertFileArgs = z.infer<typeof ConvertFileSchema>;
