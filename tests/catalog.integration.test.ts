import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { dispatchTool } from "../src/tools/catalog";

const TMP = "/tmp";

async function createTmpPng(name: string): Promise<string> {
  const path = join(TMP, name);
  const buf = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer();
  await writeFile(path, buf);
  return path;
}

describe("tool dispatcher integration", () => {
  test("should return a structured capability report", async () => {
    const result = (await dispatchTool("discover_capabilities", {})) as { content: Array<{ type: string; text: string }> };
    expect(result.content[0]?.type).toBe("text");

    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.server.name).toBe("file-converter");
    expect(parsed.features.suggestions).toBe(true);
    expect(parsed.policy.families[0].suggestedTargets).toContain(".webp");
  });

  test("should preview a conversion through the dispatcher", async () => {
    const inputPath = await createTmpPng("catalog_preview.png");
    const result = (await dispatchTool("convert_file", {
      arguments: {
        inputPath,
        targetExtension: ".webp",
        preview: true,
      },
    })) as { content: Array<{ type: string; text: string }> };

    const payload = JSON.parse(result.content[0]?.text ?? "{}");
    expect(payload.sourceKind).toBe("image");
    expect(payload.targetExtension).toBe(".webp");
    expect(payload.outputPath).toBe("/tmp/catalog_preview.webp");

    await unlink(inputPath);
  });

  test("should include a provenance manifest in conversion success output", async () => {
    const inputPath = await createTmpPng("catalog_manifest.png");
    const result = (await dispatchTool("convert_file", {
      arguments: {
        inputPath,
        targetExtension: ".webp",
      },
    })) as { content: Array<{ type: string; text: string }> };

    const payload = JSON.parse(result.content[0]?.text ?? "{}");
    expect(payload.status).toBe("success");
    expect(payload.manifest.source.path).toBe(inputPath);
    expect(payload.manifest.target.path).toBe("/tmp/catalog_manifest.webp");
    expect(payload.manifest.source.sha256).not.toBe(payload.manifest.target.sha256);

    await unlink(inputPath);
    await unlink("/tmp/catalog_manifest.webp");
  });
});
