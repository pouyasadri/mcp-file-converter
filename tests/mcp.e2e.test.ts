import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sharp from "sharp";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TMP = "/tmp";

type ToolTextResult = {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

async function createTmpPng(name: string): Promise<string> {
  const path = join(TMP, name);
  const buf = await sharp({
    create: { width: 24, height: 24, channels: 3, background: { r: 20, g: 40, b: 60 } },
  }).png().toBuffer();
  await writeFile(path, buf);
  return path;
}

describe("live MCP stdio server", () => {
  let transport: StdioClientTransport;
  let client: Client;

  beforeEach(async () => {
    transport = new StdioClientTransport({
      command: "bun",
      args: ["run", "src/index.ts"],
      cwd: process.cwd(),
      stderr: "pipe",
    });

    client = new Client({ name: "bun-test", version: "1.0.0" });
    await client.connect(transport);
  });

  afterEach(async () => {
    await transport?.close();
  });

  test("should list tools over stdio", async () => {
    const result = await client.listTools();
    expect(result.tools.some((tool) => tool.name === "convert_file")).toBe(true);
    expect(result.tools.some((tool) => tool.name === "discover_capabilities")).toBe(true);
  });

  test("should call discover_capabilities through stdio", async () => {
    const result = await client.callTool({ name: "discover_capabilities", arguments: {} }) as ToolTextResult;
    expect(result.content[0]?.type).toBe("text");

    const payload = JSON.parse(result.content[0]?.text ?? "{}");
    expect(payload.server.name).toBe("file-converter");
    expect(payload.features.previewMode).toBe(true);
  });

  test("should preview a conversion through stdio", async () => {
    const inputPath = await createTmpPng("mcp_stdio_preview.png");

    const result = await client.callTool({
      name: "convert_file",
      arguments: { inputPath, targetExtension: ".webp", preview: true },
    }) as ToolTextResult;

    const payload = JSON.parse(result.content[0]?.text ?? "{}");
    expect(payload.sourceKind).toBe("image");
    expect(payload.targetKind).toBe("image");
    expect(payload.outputPath).toBe("/tmp/mcp_stdio_preview.webp");
    expect(payload.suggestedTargets).toContain(".webp");

    await unlink(inputPath);
  });

  test("should return a tool error for missing files", async () => {
    const result = await client.callTool({
      name: "inspect_file",
      arguments: { inputPath: "/tmp/definitely-missing-file.png" },
    }) as ToolTextResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Source file not found");
  });

  test("should prefix top-level MCP errors consistently", async () => {
    const result = await client.callTool({
      name: "suggest_targets",
      arguments: {},
    }) as ToolTextResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Error during conversion:");
  });
});
