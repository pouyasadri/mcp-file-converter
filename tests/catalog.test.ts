import { describe, expect, test } from "bun:test";
import { getCapabilityReport, listTools } from "../src/tools/catalog";

describe("tool catalog", () => {
  test("should include discover_capabilities in the tool list", () => {
    const tools = listTools();
    expect(tools.some((tool) => tool.name === "discover_capabilities")).toBe(true);
  });

  test("should expose tool descriptors with input schemas", () => {
    const tools = listTools();
    const convertTool = tools.find((tool) => tool.name === "convert_file");
    expect(convertTool?.description).toContain("preview=true");
    expect(convertTool?.inputSchema).toHaveProperty("properties");
    expect(convertTool?.inputSchema).toHaveProperty("required");
  });

  test("should build a capability report from shared policy data", () => {
    const report = getCapabilityReport();
    expect(report.server.name).toBe("file-converter");
    expect(report.policy.type).toBe("family-based");
    expect(report.policy.families).toHaveLength(3);
    expect(report.features.previewMode).toBe(true);
    expect(report.tools.some((tool) => tool.name === "convert_file")).toBe(true);
  });

  test("should report discover_capabilities as a discoverable tool", () => {
    const report = getCapabilityReport();
    expect(report.tools.some((tool) => tool.name === "discover_capabilities")).toBe(false);
    expect(report.features.inspectionSuggestions).toBe(true);
    expect(report.features.provenance).toBe(true);
  });

  test("should include discover_capabilities in the tool registry with a discovery description", () => {
    const tools = listTools();
    const discoveryTool = tools.find((tool) => tool.name === "discover_capabilities");
    expect(discoveryTool?.description).toContain("provenance");
  });
});
