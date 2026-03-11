import { describe, test, expect } from "bun:test";
import sharp from "sharp";
import * as XLSX from "xlsx";
import { inspectFile } from "../src/tools/inspect";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";

const TMP = "/tmp";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createTmpPng(name: string): Promise<string> {
  const path = join(TMP, name);
  const buf = await sharp({
    create: { width: 80, height: 60, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } },
  }).png().toBuffer();
  await writeFile(path, buf);
  return path;
}

async function createTmpJson(name: string, data: unknown): Promise<string> {
  const path = join(TMP, name);
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  return path;
}

async function createTmpMd(name: string, content: string): Promise<string> {
  const path = join(TMP, name);
  await writeFile(path, content, "utf-8");
  return path;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("inspect_file — images", () => {
  test("should return correct image metadata for PNG", async () => {
    const p = await createTmpPng("inspect_test.png");
    const meta = await inspectFile(p);
    await unlink(p);

    expect(meta.type).toBe("image");
    if (meta.type === "image") {
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(80);
      expect(meta.height).toBe(60);
      expect(meta.sizeBytes).toBeGreaterThan(0);
    }
  });
});

describe("inspect_file — data files", () => {
  test("should return row count and columns for JSON array", async () => {
    const data = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
    const p = await createTmpJson("inspect_data.json", data);
    const meta = await inspectFile(p);
    await unlink(p);

    expect(meta.type).toBe("data");
    if (meta.type === "data") {
      expect(meta.rowCount).toBe(2);
      expect(meta.columns).toContain("id");
      expect(meta.columns).toContain("name");
    }
  });

  test("should return metadata for XLSX", async () => {
    const rows = [{ product: "Widget", price: 9.99 }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array);
    const p = join(TMP, "inspect_test.xlsx");
    await writeFile(p, buf);
    const meta = await inspectFile(p);
    await unlink(p);

    expect(meta.type).toBe("data");
    if (meta.type === "data") {
      expect(meta.rowCount).toBe(1);
      expect(meta.columns).toContain("product");
    }
  });
});

describe("inspect_file — markup", () => {
  test("should return character/line count for Markdown", async () => {
    const content = "# Hello\n\nThis is a test.\nLine 3.";
    const p = await createTmpMd("inspect_test.md", content);
    const meta = await inspectFile(p);
    await unlink(p);

    expect(meta.type).toBe("markup");
    if (meta.type === "markup") {
      expect(meta.characterCount).toBe(content.length);
      expect(meta.lineCount).toBe(4);
    }
  });
});

describe("inspect_file — errors", () => {
  test("should throw for unsupported extension", async () => {
    const p = join(TMP, "test.unknown_ext_xyz");
    await writeFile(p, "data", "utf-8");
    expect(inspectFile(p)).rejects.toThrow("Unsupported file type for inspection");
    await unlink(p);
  });
});
