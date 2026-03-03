import { test, expect, describe } from "bun:test";
import { join } from "node:path";
import { ConvertFileSchema } from "../src/types/index";

// A small unit test to just ensure the Zod schema natively validates the new parameters correctly
// The actual server handler runs over stdio which is harder to mock in a simple bun test,
// but validating the schema guarantees the MCP protocol will accept these arguments from an LLM.

describe("MCP Tool Schema Validation", () => {
    test("should accept base arguments", () => {
        const payload = {
            inputPath: "/tmp/fake.png",
            targetExtension: "jpg"
        };
        const parsed = ConvertFileSchema.parse(payload);
        expect(parsed.inputPath).toBe("/tmp/fake.png");
        expect(parsed.targetExtension).toBe("jpg");
        expect(parsed.overwrite).toBe(false);
    });

    test("should accept advanced image arguments", () => {
        const payload = {
            inputPath: "/tmp/fake.png",
            targetExtension: "webp",
            width: 800,
            height: 600,
            quality: 85,
            overwrite: true
        };
        const parsed = ConvertFileSchema.parse(payload);
        expect(parsed.width).toBe(800);
        expect(parsed.height).toBe(600);
        expect(parsed.quality).toBe(85);
        expect(parsed.overwrite).toBe(true);
    });

    test("should reject invalid quality arguments", () => {
        const payload = {
            inputPath: "/tmp/fake.png",
            targetExtension: "webp",
            quality: 150 // Out of bounds (1-100)
        };
        expect(() => ConvertFileSchema.parse(payload)).toThrow();
    });
});
