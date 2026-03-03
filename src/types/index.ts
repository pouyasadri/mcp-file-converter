import { z } from "zod";

export const ConvertFileSchema = z.object({
  inputPath: z.string().describe("Absolute path to the source file"),
  targetExtension: z.string().describe("Target extension (e.g., '.jpg', '.png', '.csv', '.json', '.yaml')"),
  overwrite: z.boolean().optional().default(false).describe("Whether to overwrite the original file or create a copy"),
});

export type ConvertFileArgs = z.infer<typeof ConvertFileSchema>;
