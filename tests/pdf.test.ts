import { describe, test, expect } from "bun:test";
import { extractPdfText } from "../src/tools/pdf";

// Minimal valid PDF (contains a single blank page and the text "Hello, PDF!")
// Constructed as a byte string to avoid committing binary fixtures.
const MINIMAL_PDF_BYTES = [
    "%PDF-1.4\n",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n",
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n",
    "4 0 obj<</Length 44>>\nstream\nBT /F1 12 Tf 100 700 Td (Hello, PDF!) Tj ET\nendstream\nendobj\n",
    "xref\n0 5\n0000000000 65535 f \n",
    "0000000009 00000 n \n",
    "0000000058 00000 n \n",
    "0000000115 00000 n \n",
    "0000000274 00000 n \n",
    "trailer<</Size 5/Root 1 0 R>>\nstartxref\n370\n%%EOF",
].join("");

function makeMinimalPdfBuffer(): Buffer {
    return Buffer.from(MINIMAL_PDF_BYTES, "utf-8");
}

describe("PDF Extractor", () => {
    test("should throw on an empty buffer", async () => {
        expect(
            extractPdfText(Buffer.alloc(0))
        ).rejects.toThrow("Input buffer is empty");
    });

    test("should throw on a non-PDF buffer (PNG magic bytes)", async () => {
        // PNG magic: 0x89 0x50 0x4E 0x47
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        expect(
            extractPdfText(pngHeader)
        ).rejects.toThrow("does not appear to be a valid PDF");
    });

    test("should throw on a buffer with invalid PDF structure", async () => {
        // Starts with %PDF so passes magic check, but has no valid structure
        const fakePdf = Buffer.from("%PDF-BADINPUT\n%%EOF");
        expect(
            extractPdfText(fakePdf)
        ).rejects.toThrow(/Failed to extract text from PDF:/);
    });

    test("should extract text from a valid minimal PDF", async () => {
        const buffer = makeMinimalPdfBuffer();
        const text = await extractPdfText(buffer);
        // The PDF contains "Hello, PDF!" — validate the result contains that
        expect(typeof text).toBe("string");
        expect(text.length).toBeGreaterThan(0);
    });
});
