import { describe, expect, test } from "bun:test";
import { handler } from "../index.ts";
import { readFixture } from "./helpers/fixtures.ts";

describe("XML response parser contract", () => {
  test("returns the root element name as key and child elements as data", async () => {
    const response = handler(new Response(await readFixture("object-list-page-2.xml")));
    const result = await response.json();

    expect(result.key).toBe("ListBucketResult");
    expect(result.data).toEqual({
      IsTruncated: false,
      Contents: { Key: "reports/second.txt", Size: 6, ETag: "etag-2" },
    });
  });

  test("preserves repeated child tags as arrays", async () => {
    const response = handler(new Response(await readFixture("bucket-list.xml")));
    const result = await response.json();

    expect(result.key).toBe("ListAllMyBucketsResult");
    expect(result.data.Owner).toEqual({ ID: "owner-1", DisplayName: "Test Owner" });
    expect(result.data.Buckets.Bucket).toHaveLength(2);
    expect(result.data.Buckets.Bucket.map(({ Name }: { Name: string }) => Name)).toEqual([
      "demo-bucket",
      "demo-bucket",
    ]);
  });
});
