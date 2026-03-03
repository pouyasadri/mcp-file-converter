import { describe, test, expect } from "bun:test";
import { convertImage } from "../src/converters/image";
import sharp from "sharp";

// Generate a solid color 100x100 pixel image buffer for testing
async function createTestImageBuffer(): Promise<Buffer> {
    return await sharp({
        create: {
            width: 100,
            height: 100,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 1 } // Red background
        }
    })
        .png()
        .toBuffer();
}

describe("Image Converter", () => {
    test("should convert PNG to JPEG correctly", async () => {
        const inputBuffer = await createTestImageBuffer();
        const outputBuffer = await convertImage(inputBuffer, ".jpeg");

        expect(outputBuffer).toBeInstanceOf(Buffer);

        // Verify it's a valid JPEG
        const metadata = await sharp(outputBuffer).metadata();
        expect(metadata.format).toBe("jpeg");
    });

    test("should convert PNG to WebP correctly", async () => {
        const inputBuffer = await createTestImageBuffer();
        const outputBuffer = await convertImage(inputBuffer, ".webp");

        expect(outputBuffer).toBeInstanceOf(Buffer);

        const metadata = await sharp(outputBuffer).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBe(100);
        expect(metadata.height).toBe(100);
    });

    test("should resize an image while converting", async () => {
        const inputBuffer = await createTestImageBuffer();

        // Resize down to 50x50
        const outputBuffer = await convertImage(inputBuffer, ".png", { width: 50, height: 50 });

        const metadata = await sharp(outputBuffer).metadata();
        expect(metadata.format).toBe("png");
        expect(metadata.width).toBe(50);
        expect(metadata.height).toBe(50);
    });

    test("should apply fit inside logic when only width is provided", async () => {
        const inputBuffer = await createTestImageBuffer();

        // Resize width to 50, height should scale proportionally (which is also 50 for a square)
        const outputBuffer = await convertImage(inputBuffer, ".jpeg", { width: 50 });

        const metadata = await sharp(outputBuffer).metadata();
        expect(metadata.width).toBe(50);
        expect(metadata.height).toBe(50);
    });

    test("should not enlarge an image beyond its original size", async () => {
        const inputBuffer = await createTestImageBuffer(); // original is 100x100

        // Attempting to resize to 200x200
        const outputBuffer = await convertImage(inputBuffer, ".png", { width: 200, height: 200 });

        const metadata = await sharp(outputBuffer).metadata();
        // width and height should remain 100 because of `withoutEnlargement: true`
        expect(metadata.width).toBe(100);
        expect(metadata.height).toBe(100);
    });

    test("should throw an error for unsupported extensions", async () => {
        const inputBuffer = await createTestImageBuffer();

        expect(
            convertImage(inputBuffer, ".gif")
        ).rejects.toThrow("Unsupported image target extension: .gif");
    });

    describe("Input Validation & Security", () => {
        test("should reject negative width dimensions", async () => {
            const inputBuffer = await createTestImageBuffer();

            expect(
                convertImage(inputBuffer, ".png", { width: -50 })
            ).rejects.toThrow(); // Zod will throw a ZodError
        });

        test("should reject excessive quality values", async () => {
            const inputBuffer = await createTestImageBuffer();

            expect(
                convertImage(inputBuffer, ".jpeg", { quality: 150 })
            ).rejects.toThrow();
        });

        test("should throw an error if input buffer exceeds maximum dimensions", async () => {
            // Create a deliberately large image buffer using sharp directly to bypass initial checks
            // Since sharp handles creation, we just mock options to verify the guard works without OOMing the test.
            const massiveBuffer = await sharp({
                create: {
                    width: 20000,
                    height: 100,
                    channels: 3,
                    background: { r: 0, g: 0, b: 0 }
                }
            }).jpeg().toBuffer();

            expect(
                convertImage(massiveBuffer, ".png")
            ).rejects.toThrow("Image dimensions exceed the maximum allowed limit of 16384px.");
        });
    });
});
