import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { writeFile, unlink, access } from "fs/promises";
import { join } from "path";
import { batchConvert } from "../src/tools/batch";
import { buildConversionPreview } from "../src/tools/preview";

const TMP = "/tmp";

async function createTmpPng(name: string): Promise<string> {
  const path = join(TMP, name);
  const buf = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).png().toBuffer();
  await writeFile(path, buf);
  return path;
}

describe("preview mode", () => {
  test("should build a structured preview payload", () => {
    const preview = buildConversionPreview("/tmp/demo.png", ".png", ".webp", false);
    expect(preview.sourceKind).toBe("image");
    expect(preview.targetKind).toBe("image");
    expect(preview.outputPath).toBe("/tmp/demo.webp");
    expect(preview.suggestedTargets).toContain(".webp");
  });

  test("should return planned batch output path without writing files", async () => {
    const src = await createTmpPng("single_preview.png");

    const result = await batchConvert({
      inputPaths: [src],
      targetExtension: ".webp",
      overwrite: false,
      preview: true,
    });

    expect(result.succeeded).toBe(1);
    expect(result.results[0]?.outputPath).toBe("/tmp/single_preview.webp");
    await expect(access("/tmp/single_preview.webp")).rejects.toThrow();

    await unlink(src);
  });
});
