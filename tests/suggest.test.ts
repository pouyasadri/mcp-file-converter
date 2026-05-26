import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { suggestTargets } from "../src/tools/suggest";

const TMP = "/tmp";

async function createTmpPng(name: string): Promise<string> {
  const path = join(TMP, name);
  const buf = await sharp({
    create: { width: 24, height: 24, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
  await writeFile(path, buf);
  return path;
}

describe("suggest_targets", () => {
  test("should suggest targets from source extension", async () => {
    const result = await suggestTargets({ sourceExtension: ".png" });
    expect(result.sourceKind).toBe("image");
    expect(result.suggestedTargets).toContain(".webp");
  });

  test("should suggest targets from input path", async () => {
    const p = await createTmpPng("suggest_test.png");
    const result = await suggestTargets({ inputPath: p });
    await unlink(p);

    expect(result.sourceKind).toBe("image");
    expect(result.suggestedTargets).toContain(".avif");
  });
});
