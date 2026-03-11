import { describe, test, expect } from "bun:test";
import sharp from "sharp";
import { batchConvert } from "../src/tools/batch";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";

const TMP = "/tmp";

async function createTmpPng(name: string): Promise<string> {
  const path = join(TMP, name);
  const buf = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
  await writeFile(path, buf);
  return path;
}

async function createTmpJson(name: string, data: unknown): Promise<string> {
  const path = join(TMP, name);
  await writeFile(path, JSON.stringify(data), "utf-8");
  return path;
}

describe("batch_convert_files", () => {
  test("should convert multiple images in parallel", async () => {
    const p1 = await createTmpPng("batch_img1.png");
    const p2 = await createTmpPng("batch_img2.png");

    const result = await batchConvert({
      inputPaths: [p1, p2],
      targetExtension: ".webp",
      overwrite: false,
    });

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);

    for (const r of result.results) {
      expect(r.status).toBe("success");
      expect(r.outputPath?.endsWith(".webp")).toBe(true);
    }

    // Cleanup
    await unlink(p1);
    await unlink(p2);
    for (const r of result.results) {
      if (r.outputPath) await unlink(r.outputPath).catch(() => {});
    }
  });

  test("should report individual failures without aborting the batch", async () => {
    const p1 = await createTmpPng("batch_good.png");
    const badPath = "/tmp/this_file_does_not_exist_xyz.png";

    const result = await batchConvert({
      inputPaths: [p1, badPath],
      targetExtension: ".webp",
      overwrite: false,
    });

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);

    const failure = result.results.find((r) => r.status === "failed");
    expect(failure?.error).toContain("Source file not found");

    await unlink(p1);
    for (const r of result.results) {
      if (r.outputPath) await unlink(r.outputPath).catch(() => {});
    }
  });

  test("should convert multiple data files in parallel", async () => {
    const data = [{ id: 1, name: "Test" }];
    const p1 = await createTmpJson("batch_data1.json", data);
    const p2 = await createTmpJson("batch_data2.json", data);

    const result = await batchConvert({
      inputPaths: [p1, p2],
      targetExtension: ".yaml",
      overwrite: false,
    });

    expect(result.succeeded).toBe(2);

    await unlink(p1);
    await unlink(p2);
    for (const r of result.results) {
      if (r.outputPath) await unlink(r.outputPath).catch(() => {});
    }
  });
});
