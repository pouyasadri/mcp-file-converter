import { describe, test, expect } from "bun:test";
import { convertData } from "../src/converters/data";

describe("Data Converter", () => {

    // --- Mock Data ---
    const rawJson = `[
  {
    "id": 1,
    "name": "Alice"
  },
  {
    "id": 2,
    "name": "Bob"
  }
]`;
    const jsonBuffer = Buffer.from(rawJson, "utf-8");

    const rawYaml = `- id: 1
  name: Alice
- id: 2
  name: Bob
`;
    const yamlBuffer = Buffer.from(rawYaml, "utf-8");

    const rawCsv = `id,name
1,Alice
2,Bob
`;
    const csvBuffer = Buffer.from(rawCsv, "utf-8");


    // --- Conversion Tests ---

    test("should convert JSON to YAML correctly", async () => {
        const result = await convertData(jsonBuffer, ".json", ".yaml");
        expect(result).toContain("- id: 1");
        expect(result).toContain("name: Alice");
    });

    test("should convert YAML to JSON correctly", async () => {
        const result = await convertData(yamlBuffer, ".yaml", ".json");
        // Output might have different whitespace because of stringify depth, but parsing it should match
        const parsedResult = JSON.parse(result as string);
        expect(parsedResult).toHaveLength(2);
        expect(parsedResult[0].name).toBe("Alice");
    });

    test("should convert JSON to CSV correctly", async () => {
        const result = await convertData(jsonBuffer, ".json", ".csv");
        expect(result).toContain("id,name");
        expect(result).toContain("1,Alice");
        expect(result).toContain("2,Bob");
    });

    test("should convert CSV to JSON correctly", async () => {
        const result = await convertData(csvBuffer, ".csv", ".json");
        const parsedResult = JSON.parse(result as string);
        // csv-parse defaults to returning everything as strings
        expect(parsedResult[0].id).toBe("1");
        expect(parsedResult[0].name).toBe("Alice");
    });

    // --- Error Handling Tests ---

    test("should throw on unsupported source extension", async () => {
        expect(
            convertData(jsonBuffer, ".xyz", ".json")
        ).rejects.toThrow("Unsupported source data extension: .xyz");
    });

    test("should throw on unsupported target extension", async () => {
        expect(
            convertData(jsonBuffer, ".json", ".xyz")
        ).rejects.toThrow("Unsupported target data extension: .xyz");
    });

    test("should throw a clean error message for malformed JSON parsing", async () => {
        const badJsonBuffer = Buffer.from(`{ "broken": }`, "utf-8");
        expect(
            convertData(badJsonBuffer, ".json", ".yaml")
        ).rejects.toThrow(/Failed to parse .json file:/);
    });

    // --- Markdown / HTML Tests ---

    test("should convert Markdown to HTML correctly", async () => {
        const md = `# Hello\n\nThis is a **paragraph**.`;
        const mdBuffer = Buffer.from(md, "utf-8");
        const result = await convertData(mdBuffer, ".md", ".html");
        expect(result).toContain("<h1>Hello</h1>");
        expect(result).toContain("<strong>paragraph</strong>");
    });

    test("should convert HTML to Markdown correctly", async () => {
        const html = `<h1>Hello</h1><p>This is a <strong>paragraph</strong>.</p>`;
        const htmlBuffer = Buffer.from(html, "utf-8");
        const result = await convertData(htmlBuffer, ".html", ".md");
        expect(result).toContain("# Hello");
        expect(result).toContain("**paragraph**");
    });

    // --- TOML Tests ---

    test("should convert JSON to TOML correctly", async () => {
        const json = JSON.stringify({ name: "Alice", age: 30 });
        const buf = Buffer.from(json, "utf-8");
        const result = await convertData(buf, ".json", ".toml");
        expect(result).toContain("name");
        expect(result).toContain("Alice");
    });

    test("should convert TOML to JSON correctly", async () => {
        const toml = `name = "Alice"\nage = 30\n`;
        const buf = Buffer.from(toml, "utf-8");
        const result = await convertData(buf, ".toml", ".json");
        const parsed = JSON.parse(result as string);
        expect(parsed.name).toBe("Alice");
        expect(parsed.age).toBe(30);
    });

    // --- XML Tests ---

    test("should convert JSON to XML correctly", async () => {
        const json = JSON.stringify({ name: "Alice", city: "Paris" });
        const buf = Buffer.from(json, "utf-8");
        const result = await convertData(buf, ".json", ".xml");
        expect(result).toContain("Alice");
        expect(result).toContain("Paris");
    });

    test("should convert XML to JSON correctly", async () => {
        const xml = `<root><name>Alice</name><city>Paris</city></root>`;
        const buf = Buffer.from(xml, "utf-8");
        const result = await convertData(buf, ".xml", ".json");
        const parsed = JSON.parse(result as string);
        // fast-xml-parser wraps the root element — check nested structure
        expect(JSON.stringify(parsed)).toContain("Alice");
    });
});
