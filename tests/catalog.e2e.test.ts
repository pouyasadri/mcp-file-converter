import { describe, expect, test } from "bun:test";
import { dispatchTool, listTools } from "../src/tools/catalog";

describe("catalog e2e contract", () => {
  test("should publish discover_capabilities and return valid JSON text", async () => {
    const tools = listTools();
    expect(tools.map((tool) => tool.name)).toContain("discover_capabilities");
    expect(tools.length).toBeGreaterThanOrEqual(7);

    const result = (await dispatchTool("discover_capabilities", {})) as { content: Array<{ type: string; text: string }> };
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe("text");

    const payload = JSON.parse(result.content[0]?.text ?? "{}");
    expect(payload.policy.type).toBe("family-based");
    expect(payload.server.version).toBe("2.0.0");
    expect(payload.features.previewMode).toBe(true);
    expect(payload.features.provenance).toBe(true);
    expect(payload.tools.some((tool: { name: string }) => tool.name === "suggest_targets")).toBe(true);
  });
});
