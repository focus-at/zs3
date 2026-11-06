import { describe, expect, test } from "bun:test";
import { readFixture } from "./helpers/fixtures.ts";

describe("fixture includes", () => {
  test("expands included XML fragments in fixture files", async () => {
    const xml = await readFixture("bucket-list.xml");

    expect(xml).not.toContain("<!--include:");
    expect(xml).toContain("<Name>demo-bucket</Name>");
    expect(xml).toContain("<CreationDate>2026-01-01T00:00:00.000Z</CreationDate>");
  });

  test("expands multiple included XML fragments", async () => {
    const xml = await readFixture("object-list-repeated.xml");

    expect(xml).not.toContain("<!--include:");
    expect(xml.match(/<Contents>/g)).toHaveLength(2);
    expect(xml).toContain("<Key>a.txt</Key>");
    expect(xml).toContain("<Key>b.txt</Key>");
  });

  test("rejects includes that escape the fixtures directory", async () => {
    await expect(readFixture("../helpers/fixtures.ts")).rejects.toThrow("must stay inside tests/fixtures");
  });
});
