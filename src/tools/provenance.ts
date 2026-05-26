import { readFile } from "fs/promises";
import { createHash } from "crypto";
import { extname } from "path";
import { getFileKind, normalizeExtension, type FileKind } from "./routing.js";

export interface FileSnapshot {
  path: string;
  extension: string;
  kind: FileKind;
  sizeBytes: number;
  sha256: string;
}

export interface ConversionManifest {
  startedAt: string;
  completedAt: string;
  source: FileSnapshot;
  target: FileSnapshot;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function buildFileSnapshot(filePath: string): Promise<FileSnapshot> {
  const buffer = await readFile(filePath);
  const extension = normalizeExtension(extname(filePath));
  return {
    path: filePath,
    extension,
    kind: getFileKind(extension),
    sizeBytes: buffer.length,
    sha256: sha256(buffer),
  };
}

export async function buildConversionManifest(args: {
  inputPath: string;
  outputPath: string;
  startedAt?: Date;
  completedAt?: Date;
}): Promise<ConversionManifest> {
  const startedAt = args.startedAt ?? new Date();
  const completedAt = args.completedAt ?? new Date();
  return {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    source: await buildFileSnapshot(args.inputPath),
    target: await buildFileSnapshot(args.outputPath),
  };
}
