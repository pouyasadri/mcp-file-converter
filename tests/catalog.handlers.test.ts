import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { dispatchTool } from "../src/tools/catalog";

const TMP = "/tmp";

async function createTmpPng(name: string): Promise<string> {
  const path = join(TMP, name);
  const buf = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 8, g: 16, b: 24 } },
  }).png().toBuffer();
  await writeFile(path, buf);
  return path;
}

describe("tool dispatcher handlers", () => {
  test("should reject unknown tools", async () => {
    await expect(dispatchTool("missing_tool", {})).rejects.toThrow("Unknown tool: missing_tool");
  });

  test("should reject convert_file with invalid family pairing", async () => {
    const inputPath = await createTmpPng("catalog_invalid_pair.png");

    await expect(
      dispatchTool("convert_file", {
        arguments: {
          inputPath,
          targetExtension: ".json",
        },
      })
    ).rejects.toThrow("Cannot convert a image (.png) to a structured data (.json)");

    await unlink(inputPath);
  });

  test("should reject suggest_targets without input", async () => {
    await expect(dispatchTool("suggest_targets", { arguments: {} })).rejects.toThrow(
      "Provide inputPath or sourceExtension."
    );
  });

  test("should surface batch validation errors", async () => {
    await expect(
      dispatchTool("batch_convert_files", {
        arguments: { inputPaths: [], targetExtension: ".webp" },
      })
    ).rejects.toThrow();
  });
});
