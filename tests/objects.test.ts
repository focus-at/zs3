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
      { Key: "a.txt", Size: 1, ETag: 'etag-a' },
      { Key: "b.txt", Size: 2, ETag: 'etag-b' },
    ]);
  });
});
