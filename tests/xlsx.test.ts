import { describe, test, expect } from "bun:test";
import * as XLSX from "xlsx";
import { convertData } from "../src/converters/data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeXlsxBuffer(rows: Record<string, unknown>[]): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return Buffer.from(
        XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("XLSX Converter", () => {
    const sampleRows = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
    ];

    test("should convert XLSX to JSON correctly", async () => {
        const xlsxBuffer = makeXlsxBuffer(sampleRows);
        const result = await convertData(xlsxBuffer, ".xlsx", ".json");
        const parsed = JSON.parse(result as string);
        expect(parsed).toHaveLength(2);
        // xlsx reads numeric cells as numbers
        expect(parsed[0].name).toBe("Alice");
        expect(parsed[1].name).toBe("Bob");
    });

    test("should convert XLSX to CSV correctly", async () => {
        const xlsxBuffer = makeXlsxBuffer(sampleRows);
        const result = await convertData(xlsxBuffer, ".xlsx", ".csv");
        expect(result).toContain("name");
        expect(result).toContain("Alice");
        expect(result).toContain("Bob");
    });

    test("should convert XLSX to YAML correctly", async () => {
        const xlsxBuffer = makeXlsxBuffer(sampleRows);
        const result = await convertData(xlsxBuffer, ".xlsx", ".yaml");
        expect(result).toContain("name: Alice");
        expect(result).toContain("name: Bob");
    });

    test("should convert JSON to XLSX and produce a valid buffer", async () => {
        const jsonData = JSON.stringify(sampleRows);
        const jsonBuffer = Buffer.from(jsonData, "utf-8");
        const result = await convertData(jsonBuffer, ".json", ".xlsx");

        // Result should be a Buffer (binary XLSX)
        expect(result).toBeInstanceOf(Buffer);

        // Parse the output back to verify round-trip
        const wb = XLSX.read(result as Buffer, { type: "buffer" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName!]!;
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        expect(rows).toHaveLength(2);
        expect(rows[0]!["name"]).toBe("Alice");
    });

    test("should throw on unsupported target extension from XLSX source", async () => {
        const xlsxBuffer = makeXlsxBuffer(sampleRows);
        expect(
            convertData(xlsxBuffer, ".xlsx", ".xml")
        ).rejects.toThrow("Unsupported target data extension: .xml");
    });
});
