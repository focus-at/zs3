import { afterEach, describe, expect, test } from "bun:test";
import { zs3 } from "../index.ts";
import { readFixture } from "./helpers/fixtures.ts";
import { mockFetch, restoreMockFetch } from "./helpers/mock-fetch.ts";

afterEach(restoreMockFetch);

describe("XML response parsing details", () => {
  test("returns the root tag and normalizes repeated entries", async () => {
    mockFetch(new Response(await readFixture("object-list-repeated.xml"), { status: 200 }));
    const client = zs3({ endpoint: "https://s3.example.test", accessKeyId: "key", secretAccessKey: "secret" });

    const response = await client.exec({ method: "GET", bucket: "demo", prefix: "reports/" });
    const result = await response.json();

    expect(result.key).toBe("ListBucketResult");
    expect(result.data.IsTruncated).toBe(false);
    expect(result.data.Contents).toEqual([
      { ETag: "etag-a", Key: "a.txt", Size: 1, LastModified: "2026-11-06T12:00:00.000Z",  StorageClass: "STANDARD" },
      { ETag: "etag-b", Key: "b.txt", Size: 2, LastModified: "2026-11-06T12:01:00.000Z",  StorageClass: "STANDARD" },
    ]);
  });
});
