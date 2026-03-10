import { PDFParse } from "pdf-parse";

/**
 * Extracts all text content from a PDF file buffer.
 * Throws a descriptive error if the buffer is not a valid PDF
 * or if parsing fails for any other reason.
 */
export async function extractPdfText(inputBuffer: Buffer): Promise<string> {
    if (!inputBuffer || inputBuffer.length === 0) {
        throw new Error("Input buffer is empty. Provide a valid PDF file.");
    }

    // PDF magic bytes: %PDF
    if (!inputBuffer.slice(0, 4).equals(Buffer.from("%PDF"))) {
        throw new Error("Input file does not appear to be a valid PDF (missing %PDF header).");
    }

    try {
        // pdf-parse v2: pass binary data via LoadParameters, then call getText()
        const parser = new PDFParse({ data: new Uint8Array(inputBuffer) });
        const result = await parser.getText();
        return result.text;
    } catch (error: any) {
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}
