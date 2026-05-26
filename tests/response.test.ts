import { describe, expect, test } from "bun:test";
import {
  formatBatchConversionMessage,
  formatConversionSuccessMessage,
  formatJsonResponse,
} from "../src/tools/response";

describe("response formatter", () => {
  test("should format JSON with stable indentation", () => {
    const text = formatJsonResponse({ a: 1, b: { c: true } });
    expect(text).toContain("\n  \"a\": 1,");
    expect(text).toContain("\n    \"c\": true");
  });

  test("should format conversion success text", () => {
    const text = formatConversionSuccessMessage({
      inputPath: "/tmp/demo.png",
      targetExtension: ".webp",
      outputPath: "/tmp/demo.webp",
    });
    expect(text).toContain("Successfully converted /tmp/demo.png to .webp");
  });

  test("should format batch conversion summary", () => {
    const text = formatBatchConversionMessage({
      succeeded: 1,
      total: 2,
      results: [
        { inputPath: "/tmp/a.png", status: "success", outputPath: "/tmp/a.webp" },
        { inputPath: "/tmp/b.png", status: "failed", error: "boom" },
      ],
    });
    expect(text).toContain("Batch conversion complete: 1/2 succeeded.");
    expect(text).toContain("✅ /tmp/a.png → /tmp/a.webp");
    expect(text).toContain("❌ /tmp/b.png: boom");
  });
});
