import { describe, test, expect } from "bun:test";
import { compressFile, decompressFile } from "../src/tools/compress";
import { writeFile, readFile, unlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const TMP = "/tmp";

async function createTmpFile(name: string, content: string): Promise<string> {
  const path = join(TMP, name);
  await writeFile(path, content, "utf-8");
  return path;
}

describe("compress_file — gzip", () => {
  test("should compress a file to .gz and produce a smaller (or equal) file", async () => {
    const src = await createTmpFile("compress_test.txt", "Hello, world! ".repeat(100));
    const result = await compressFile(src, "gz");

    expect(result.outputPath).toBe(`${src}.gz`);
    expect(result.compressedSizeBytes).toBeGreaterThan(0);
    // Repetitive text should compress well
    expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);

    await unlink(src);
    await unlink(result.outputPath);
  });
});

describe("compress_file — zip", () => {
  test("should compress a file to .zip", async () => {
    const src = await createTmpFile("compress_zip_test.txt", "Hello from zip! ".repeat(50));
    const result = await compressFile(src, "zip");

    expect(result.outputPath.endsWith(".zip")).toBe(true);
    expect(existsSync(result.outputPath)).toBe(true);

    await unlink(src);
    await unlink(result.outputPath);
  });
});

describe("decompress_file — gzip", () => {
  test("should decompress a .gz file back to original content", async () => {
    const originalContent = "Compressible text content! ".repeat(20);
    const src = await createTmpFile("decompress_test.txt", originalContent);
    const compressed = await compressFile(src, "gz");

    // Remove original, decompress back
    await unlink(src);
    const decompressed = await decompressFile(compressed.outputPath);

    const restored = await readFile(decompressed.outputPath, "utf-8");
    expect(restored).toBe(originalContent);

    await unlink(compressed.outputPath);
    await unlink(decompressed.outputPath);
  });
});

describe("decompress_file — errors", () => {
  test("should throw for unsupported format", async () => {
    const src = await createTmpFile("unsupported.tar", "data");
    expect(
      decompressFile(src)
    ).rejects.toThrow("Unsupported compression format");
    await unlink(src);
  });
});
