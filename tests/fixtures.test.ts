import { describe, expect, test } from "bun:test";
import { readFixture } from "./helpers/fixtures.ts";

describe("fixture includes", () => {
  test("expands root-level owner and bucket partials", async () => {
    const xml = await readFixture("bucket-list.xml");

    expect(xml).not.toContain("<!--include:");
    expect(xml.match(/<Owner>/g)).toHaveLength(1);
    expect(xml.match(/<Bucket>/g)).toHaveLength(2);
    expect(xml).toContain("<Name>demo-bucket</Name>");
    expect(xml).toContain("<Name>archive-bucket</Name>");
    expect(xml).toContain("<DisplayName>Test Owner</DisplayName>");
  });

  test("expands nested object partials including a complete Owner element", async () => {
    const xml = await readFixture("object-list-page-1.xml");

    expect(xml).not.toContain("<!--include:");
    expect(xml.match(/<Contents>/g)).toHaveLength(2);
    expect(xml.match(/<Owner>/g)).toHaveLength(1);
    expect(xml).toContain("<DisplayName>Test Owner</DisplayName>");
    expect(xml).toContain("<Key>reports/first.txt</Key>");
    expect(xml).toContain("<Key>reports/second.txt</Key>");
  });

  test("uses several reusable version and multipart part partials", async () => {
    const versions = await readFixture("object-versions.xml");
    const parts = await readFixture("multipart-list-parts.xml");

    expect(versions).not.toContain("<!--include:");
    expect(versions.match(/<Version>/g)).toHaveLength(2);
    expect(versions.match(/<Owner>/g)).toHaveLength(3);
    expect(versions).toContain("<DeleteMarker>");
    expect(versions).toContain("<DisplayName>Project Owner</DisplayName>");
    expect(parts).not.toContain("<!--include:");
    expect(parts.match(/<Part>/g)).toHaveLength(2);
  });

  test("rejects fixture paths outside the fixtures directory", async () => {
    await expect(readFixture("../helpers/fixtures.ts")).rejects.toThrow("must stay inside tests/fixtures");
  });
});
