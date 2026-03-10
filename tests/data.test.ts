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
            convertData(jsonBuffer, ".xml", ".json")
        ).rejects.toThrow("Unsupported source data extension: .xml");
    });

    test("should throw on unsupported target extension", async () => {
        expect(
            convertData(jsonBuffer, ".json", ".xml")
        ).rejects.toThrow("Unsupported target data extension: .xml");
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
});
