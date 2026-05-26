import { describe, expect, test } from "bun:test";
import { convertData } from "../src/converters/data";

describe("data converter edge cases", () => {
  test("should accept yml aliases", async () => {
    const yaml = Buffer.from("name: Alice\ncity: Paris\n", "utf-8");
    const result = await convertData(yaml, ".yml", ".json");
    const parsed = JSON.parse(result as string);

    expect(parsed.name).toBe("Alice");
    expect(parsed.city).toBe("Paris");
  });

  test("should preserve XML attributes during parsing", async () => {
    const xml = Buffer.from('<root id="123"><name>Alice</name></root>', "utf-8");
    const result = await convertData(xml, ".xml", ".json");
    const parsed = JSON.parse(result as string);

    expect(JSON.stringify(parsed)).toContain("123");
    expect(JSON.stringify(parsed)).toContain("Alice");
  });

  test("should fail cleanly on malformed TOML", async () => {
    const toml = Buffer.from('name = "Alice"\nbroken = [1,', "utf-8");
    await expect(convertData(toml, ".toml", ".json")).rejects.toThrow(/Failed to parse \.toml file:/);
  });
});
