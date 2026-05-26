import { test, expect, describe } from "bun:test";
import { ConvertFileSchema, SuggestTargetsSchema } from "../src/types/index";
import { BatchConvertSchema } from "../src/types/index";
import { ImageConversionOptionsSchema } from "../src/converters/image";

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

    test("should apply defaults for batch arguments", () => {
        const parsed = BatchConvertSchema.parse({ inputPaths: ["/tmp/a.png"], targetExtension: ".webp" });
        expect(parsed.overwrite).toBe(false);
        expect(parsed.preview).toBe(false);
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

    test("should accept preview mode", () => {
        const payload = {
            inputPath: "/tmp/fake.png",
            targetExtension: "webp",
            preview: true
        };
        const parsed = ConvertFileSchema.parse(payload);
        expect(parsed.preview).toBe(true);
    });

    test("should reject invalid quality arguments", () => {
        const payload = {
            inputPath: "/tmp/fake.png",
            targetExtension: "webp",
            quality: 150 // Out of bounds (1-100)
        };
        expect(() => ConvertFileSchema.parse(payload)).toThrow();
    });

    test("should accept suggest_targets schema by inputPath", () => {
        const parsed = SuggestTargetsSchema.parse({ inputPath: "/tmp/file.png" });
        expect(parsed.inputPath).toBe("/tmp/file.png");
    });

    test("should accept suggest_targets schema by sourceExtension", () => {
        const parsed = SuggestTargetsSchema.parse({ sourceExtension: ".png" });
        expect(parsed.sourceExtension).toBe(".png");
    });

    test("should reject invalid image conversion dimensions", () => {
        expect(() => ImageConversionOptionsSchema.parse({ width: 0 })).toThrow();
        expect(() => ImageConversionOptionsSchema.parse({ width: 20000 })).toThrow();
    });

    test("should reject oversized convert_file dimensions at the schema boundary", () => {
        expect(() => ConvertFileSchema.parse({ inputPath: "/tmp/fake.png", targetExtension: "webp", width: 20000 })).toThrow();
    });

    test("should reject oversized batch dimensions at the schema boundary", () => {
        expect(() => BatchConvertSchema.parse({ inputPaths: ["/tmp/a.png"], targetExtension: ".webp", height: 20000 })).toThrow();
    });
});
