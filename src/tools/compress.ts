import { createReadStream, createWriteStream } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";
import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";
import unzipper from "unzipper";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompressResult {
  outputPath: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

export interface DecompressResult {
  outputPath: string;
  extractedFiles: string[];
}

// ── Compress ──────────────────────────────────────────────────────────────────

export async function compressFile(
  inputPath: string,
  format: "gz" | "zip"
): Promise<CompressResult> {
  const inputBuffer = await readFile(inputPath);
  const originalSizeBytes = inputBuffer.length;
  const inputBase = basename(inputPath);

  if (format === "gz") {
    // gzip: single-file compression, output is <filename>.gz
    const outputPath = `${inputPath}.gz`;
    const source = createReadStream(inputPath);
    const dest = createWriteStream(outputPath);
    await pipeline(source, createGzip(), dest);
    const compressedBuffer = await readFile(outputPath);
    return { outputPath, originalSizeBytes, compressedSizeBytes: compressedBuffer.length };
  }

  // zip: archive the file inside a zip container
  const outputPath = join(dirname(inputPath), `${basename(inputPath, extname(inputPath))}.zip`);
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(inputPath, { name: inputBase });
    void archive.finalize();
  });

  const compressedBuffer = await readFile(outputPath);
  return { outputPath, originalSizeBytes, compressedSizeBytes: compressedBuffer.length };
}

// ── Decompress ────────────────────────────────────────────────────────────────

export async function decompressFile(
  inputPath: string,
  outputDir?: string
): Promise<DecompressResult> {
  const ext = extname(inputPath).toLowerCase();
  const targetDir = outputDir ?? dirname(inputPath);
  await mkdir(targetDir, { recursive: true });

  if (ext === ".gz") {
    // Restore original filename by stripping .gz
    const outputName = basename(inputPath, ".gz");
    const outputPath = join(targetDir, outputName);
    const source = createReadStream(inputPath);
    const dest = createWriteStream(outputPath);
    await pipeline(source, createGunzip(), dest);
    return { outputPath, extractedFiles: [outputPath] };
  }

  if (ext === ".zip") {
    const extractedFiles: string[] = [];
    await new Promise<void>((resolve, reject) => {
      createReadStream(inputPath)
        .pipe(unzipper.Parse())
        .on("entry", (entry: unzipper.Entry) => {
          const fullPath = join(targetDir, entry.path);
          extractedFiles.push(fullPath);
          if (entry.type === "File") {
            entry.pipe(createWriteStream(fullPath));
          } else {
            entry.autodrain();
          }
        })
        .on("close", resolve)
        .on("error", reject);
    });
    return { outputPath: targetDir, extractedFiles };
  }

  throw new Error(`Unsupported compression format: ${ext}. Supported: .gz, .zip`);
}
