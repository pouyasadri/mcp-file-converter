import { expect, test } from "bun:test";
import { extname } from "node:path";

test("path extension logic", () => {
    expect(extname("test.json")).toBe(".json");
    expect(extname("image.png")).toBe(".png");
});

test("environment check", () => {
    expect(process.env.NODE_ENV).toBeDefined;
});
