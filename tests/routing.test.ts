import { describe, expect, test } from "bun:test";
import {
  canConvertBetween,
  getFamilyConversionError,
  getFileKind,
  getSupportedExtensions,
  getSuggestedTargetMessage,
  getTargetSuggestions,
  normalizeExtension,
} from "../src/tools/routing";

describe("routing helpers", () => {
  test("normalizes extensions consistently", () => {
    expect(normalizeExtension("jpg")).toBe(".jpg");
    expect(normalizeExtension(".PNG")).toBe(".png");
    expect(normalizeExtension("  json  ")).toBe(".json");
  });

  test("classifies file kinds", () => {
    expect(getFileKind(".jpg")).toBe("image");
    expect(getFileKind(".csv")).toBe("structured");
    expect(getFileKind(".md")).toBe("markup");
    expect(getFileKind(".exe")).toBe("unsupported");
  });

  test("exposes allowed targets per family", () => {
    expect(getSupportedExtensions("image")).toContain(".png");
    expect(getSupportedExtensions("structured")).toContain(".json");
    expect(getSupportedExtensions("markup")).toContain(".html");
  });

  test("blocks cross-family conversions", () => {
    expect(canConvertBetween(".png", ".json")).toBe(false);
    expect(getFamilyConversionError(".png", ".json")).toContain("Cannot convert an image");
    expect(canConvertBetween(".json", ".yaml")).toBe(true);
    expect(canConvertBetween(".md", ".html")).toBe(true);
  });

  test("suggests targets by file kind", () => {
    expect(getSuggestedTargetMessage(".png")).toContain(".webp");
    expect(getSuggestedTargetMessage(".json")).toContain(".yaml");
    expect(getSuggestedTargetMessage(".md")).toContain(".html");
  });

  test("builds structured target suggestions", () => {
    const result = getTargetSuggestions(".png");
    expect(result.sourceKind).toBe("image");
    expect(result.suggestedTargets).toContain(".webp");
  });
});
