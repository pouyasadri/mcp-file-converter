import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import { extractStructuredRows, parseStructuredData } from "../src/structured";

describe("shared structured helpers", () => {
  test("should parse JSON into structured rows", () => {
    const buf = Buffer.from(JSON.stringify([{ id: 1 }, { id: 2 }]), "utf-8");
    const rows = extractStructuredRows(buf, ".json");

    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(1);
  });

  test("should parse YAML objects directly", () => {
    const buf = Buffer.from("name: Alice\ncity: Paris\n", "utf-8");
    const parsed = parseStructuredData(buf, ".yaml");

    expect(Array.isArray(parsed)).toBe(false);
    if (!Array.isArray(parsed)) {
      expect(parsed.name).toBe("Alice");
      expect(parsed.city).toBe("Paris");
    }
  });

  test("should parse XLSX rows", () => {
    const ws = XLSX.utils.json_to_sheet([{ name: "Widget" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array);

    const rows = extractStructuredRows(buf, ".xlsx");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Widget");
  });
});
