import { describe, expect, test } from "bun:test";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { batchConvert } from "../src/tools/batch";
import { compressFile, decompressFile } from "../src/tools/compress";
import { inspectFile } from "../src/tools/inspect";
import { suggestTargets } from "../src/tools/suggest";

const TMP = "/tmp";

async function createTmpFile(name: string, content: string): Promise<string> {
  const path = join(TMP, name);
  await writeFile(path, content, "utf-8");
  return path;
}

describe("negative paths", () => {
  test("batch conversion should report same-extension files as failures", async () => {
    const src = await createTmpFile("negative_batch.json", JSON.stringify({ ok: true }));

    const result = await batchConvert({
      inputPaths: [src],
      targetExtension: ".json",
      overwrite: false,
    });

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0]?.error).toContain("Source and target extensions are the same");

    await unlink(src);
  });

  test("compressFile should fail for missing sources", async () => {
    await expect(compressFile("/tmp/does-not-exist-negative.txt", "gz")).rejects.toThrow();
  });

  test("decompressFile should fail for invalid gzip content", async () => {
    const src = await createTmpFile("negative_invalid.gz", "not a gzip payload");

    await expect(decompressFile(src)).rejects.toThrow();

    await unlink(src);
  });

  test("inspectFile should fail for unsupported extensions", async () => {
    const src = await createTmpFile("negative_invalid.bin", "payload");

    await expect(inspectFile(src)).rejects.toThrow("Unsupported file type for inspection");

    await unlink(src);
  });

  test("suggestTargets should fail when input file is missing", async () => {
    await expect(suggestTargets({ inputPath: "/tmp/missing-suggest-source.png" })).rejects.toThrow(
      "ENOENT: no such file or directory"
    );
  });
});
